import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import sharp from 'sharp'
import { collectBlocks } from './block-extractor.mjs'
import { DEFAULT_OUT_DIR } from './constants.mjs'
import { readConfig } from './config.mjs'
import { discoverPages } from './crawl.mjs'
import {
  alphaCleanupThreshold,
  cleanupAlphaHalo,
  captureInnerHiddenPage,
  captureIsolatedItemPage,
  captureTextlessPage,
  edgeCleanupInsets,
  getCropPadding,
  normalizeCornerRadii,
  readMediaSource,
  roundedMask,
  shouldHideOuterEffects,
  shouldHideInnerContent,
  shouldUseBrowserShape,
  visualCornerRadii
} from './image-crops.mjs'
import {
  normalizeDimension,
  normalizeMaxPages,
  normalizeUrl,
  shouldCrawlByDefault,
  slugFromUrl
} from './url-utils.mjs'

const primePageForCapture = async (page, viewportHeight) => {
  await page.evaluate(async (height) => {
    const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    await document.fonts?.ready?.catch?.(() => undefined)

    const pageHeight = Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0
    )
    const maxScroll = Math.max(0, pageHeight - window.innerHeight)
    const step = Math.max(200, Math.floor((height || window.innerHeight) * 0.25))
    const positions = [0]

    for (let y = step; y < maxScroll; y += step) {
      positions.push(y)
    }

    if (maxScroll > 0) positions.push(maxScroll)

    for (const y of positions) {
      window.scrollTo(0, y)
      await waitFrame()
      await wait(350)
    }

    window.scrollTo(0, 0)
    await waitFrame()
    await wait(1000)
  }, viewportHeight).catch(() => undefined)
}

const captureScrolledFullPage = async (page, outputPath, viewportWidth, viewportHeight) => {
  const pageSize = await page.evaluate(() => ({
    width: Math.ceil(Math.max(
      document.body?.scrollWidth || 0,
      document.documentElement?.scrollWidth || 0,
      window.innerWidth
    )),
    height: Math.ceil(Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0,
      window.innerHeight
    ))
  }))
  const imageWidth = Math.max(viewportWidth, pageSize.width)
  const imageHeight = Math.max(viewportHeight, pageSize.height)
  const maxScroll = Math.max(0, imageHeight - viewportHeight)
  const positions = [0]

  for (let y = viewportHeight; y < maxScroll; y += viewportHeight) {
    positions.push(y)
  }

  if (maxScroll > 0 && positions.at(-1) !== maxScroll) positions.push(maxScroll)

  const composites = []

  for (const [index, y] of positions.entries()) {
    await page.evaluate(async ({ scrollY, hideFixed }) => {
      const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      let style = document.getElementById('separateweb-capture-hide-fixed')

      if (!style) {
        style = document.createElement('style')
        style.id = 'separateweb-capture-hide-fixed'
        style.textContent = '[data-separateweb-capture-fixed="true"]{visibility:hidden!important}'
        document.head.append(style)
      }

      document.querySelectorAll('[data-separateweb-capture-fixed]').forEach((element) => {
        element.removeAttribute('data-separateweb-capture-fixed')
      })

      if (hideFixed) {
        document.querySelectorAll('body *').forEach((element) => {
          if (getComputedStyle(element).position === 'fixed') {
            element.setAttribute('data-separateweb-capture-fixed', 'true')
          }
        })
      }

      window.scrollTo(0, scrollY)
      await waitFrame()
      await wait(350)
    }, { scrollY: y, hideFixed: index > 0 })

    composites.push({
      input: await page.screenshot({ fullPage: false }),
      left: 0,
      top: Math.round(y)
    })
  }

  await page.evaluate(() => {
    document.querySelectorAll('[data-separateweb-capture-fixed]').forEach((element) => {
      element.removeAttribute('data-separateweb-capture-fixed')
    })
    document.getElementById('separateweb-capture-hide-fixed')?.remove()
    window.scrollTo(0, 0)
  }).catch(() => undefined)

  const { width, height } = await sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png()
    .toFile(outputPath)

  const buffer = await sharp(outputPath).png().toBuffer()

  return {
    buffer,
    width: width || imageWidth,
    height: height || imageHeight
  }
}

const isLowSignalImage = async (buffer) => {
  const stats = await sharp(buffer).stats()
  const alpha = stats.channels[3]

  return Boolean(alpha && alpha.max < 32)
}

const applyAlphaTrim = async (buffer, trim) => {
  if (!trim) return buffer

  return sharp(buffer)
    .extract({
      left: trim.x,
      top: trim.y,
      width: trim.width,
      height: trim.height
    })
    .png()
    .toBuffer()
}

const applyOutputCut = async (buffer, trim, outputBuffer) => {
  const trimmed = await applyAlphaTrim(buffer, trim)
  const textRaw = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const outputAlpha = await sharp(outputBuffer)
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true })

  if (
    textRaw.info.width !== outputAlpha.info.width
    || textRaw.info.height !== outputAlpha.info.height
  ) {
    throw new Error('Output alpha mask dimensions do not match text crop')
  }

  for (let index = 0, pixel = 0; index < textRaw.data.length; index += 4, pixel += 1) {
    textRaw.data[index + 3] = outputAlpha.data[pixel]
  }

  return sharp(textRaw.data, {
    raw: {
      width: textRaw.info.width,
      height: textRaw.info.height,
      channels: 4
    }
  })
    .png()
    .toBuffer()
}

export const capturePage = async (browser, url, outputDir, options) => {
  const width = normalizeDimension(options.width, '--width')
  const height = normalizeDimension(options.height, '--height')
  const itemDir = join(outputDir, 'without-text', 'items')
  const textItemDir = join(outputDir, 'with-text', 'items')
  const fullPagePath = join(outputDir, 'full-page.png')
  const textlessPagePath = join(outputDir, 'full-page-textless.png')
  const withTextFullPagePath = join(outputDir, 'with-text', 'full-page.png')
  const withoutTextFullPagePath = join(outputDir, 'without-text', 'full-page.png')
  const manifestPath = join(outputDir, 'manifest.json')

  await mkdir(itemDir, { recursive: true })
  await mkdir(textItemDir, { recursive: true })
  await mkdir(join(outputDir, 'with-text'), { recursive: true })
  await mkdir(join(outputDir, 'without-text'), { recursive: true })

  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1
  })

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined)
    await primePageForCapture(page, height)

    const title = await page.title()
    const scrolledScreenshot = await captureScrolledFullPage(page, fullPagePath, width, height)
    const screenshotBuffer = scrolledScreenshot.buffer
    await writeFile(withTextFullPagePath, screenshotBuffer)
    const rawItems = await collectBlocks(page)
    const textlessScreenshotBuffer = await captureTextlessPage(page, textlessPagePath)
    await writeFile(withoutTextFullPagePath, textlessScreenshotBuffer)
    const imageWidth = scrolledScreenshot.width || width
    const imageHeight = scrolledScreenshot.height || height
    const items = []

    for (const [index, item] of rawItems.entries()) {
      const cropPadding = getCropPadding(item, imageWidth, imageHeight)
      const left = Math.max(0, Math.floor(item.bounds.x - cropPadding))
      const top = Math.max(0, Math.floor(item.bounds.y - cropPadding))
      const right = Math.min(imageWidth, Math.ceil(item.bounds.x + item.bounds.width + cropPadding))
      const bottom = Math.min(imageHeight, Math.ceil(item.bounds.y + item.bounds.height + cropPadding))
      const cropWidth = right - left
      const cropHeight = bottom - top

      if (cropWidth < 1 || cropHeight < 1) continue

      const kindDir = join(itemDir, item.kind)
      const textKindDir = join(textItemDir, item.kind)
      const imageName = `${String(index + 1).padStart(3, '0')}-${item.id}-${item.kind}.png`
      const imagePath = join(kindDir, imageName)
      const textImagePath = join(textKindDir, imageName)
      const mediaSource = await readMediaSource(item)
      const isolatedScreenshotBuffer = await captureIsolatedItemPage(page, item, { hideText: true })
      const itemScreenshotBuffer = isolatedScreenshotBuffer || await captureInnerHiddenPage(page, item) || textlessScreenshotBuffer
      const cornerRadii = normalizeCornerRadii(item.cornerRadii, cropWidth, cropHeight)
      const maskRadii = visualCornerRadii(item, cornerRadii, cropWidth, cropHeight)
      const useBrowserShape = Boolean(isolatedScreenshotBuffer) && shouldUseBrowserShape(item)
      const mask = useBrowserShape ? null : roundedMask(cropWidth, cropHeight, maskRadii)

      await mkdir(kindDir, { recursive: true })
      const crop = mediaSource
        ? sharp(mediaSource.buffer)
          .resize(cropWidth, cropHeight, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
        : sharp(itemScreenshotBuffer)
          .extract({
            left,
            top,
            width: cropWidth,
            height: cropHeight
          })

      if (mask) {
        crop
          .ensureAlpha()
          .composite([{
            input: await sharp(mask)
              .resize(cropWidth, cropHeight, { fit: 'fill' })
              .png()
              .toBuffer(),
            blend: 'dest-in'
          }])
      }

      const textCrop = sharp(screenshotBuffer)
        .extract({
          left,
          top,
          width: cropWidth,
          height: cropHeight
        })

      let outputBuffer = await crop
        .png()
        .toBuffer()
      const rawTextOutputBuffer = await textCrop
        .png()
        .toBuffer()
      let textOutputBuffer = rawTextOutputBuffer

      if (await isLowSignalImage(outputBuffer)) continue

      const alphaCleanup = useBrowserShape
        ? await cleanupAlphaHalo(outputBuffer, alphaCleanupThreshold(item))
        : {
            buffer: outputBuffer,
            trim: null,
            alphaThreshold: null
          }
      const textAlphaCleanup = useBrowserShape
        ? {
            buffer: await applyOutputCut(rawTextOutputBuffer, alphaCleanup.trim, alphaCleanup.buffer),
            trim: alphaCleanup.trim,
            alphaThreshold: alphaCleanup.alphaThreshold
          }
        : {
            buffer: await applyOutputCut(rawTextOutputBuffer, null, alphaCleanup.buffer),
            trim: null,
            alphaThreshold: null
          }

      outputBuffer = alphaCleanup.buffer
      textOutputBuffer = textAlphaCleanup.buffer
      const edgeInsets = edgeCleanupInsets(item)
      let edgeTrim = null
      const edgeMetadata = await sharp(outputBuffer).metadata()
      const edgeWidth = edgeMetadata.width || cropWidth
      const edgeHeight = edgeMetadata.height || cropHeight
      const edgeTrimWidth = edgeWidth - edgeInsets.left - edgeInsets.right
      const edgeTrimHeight = edgeHeight - edgeInsets.top - edgeInsets.bottom

      if (edgeTrimWidth > 0 && edgeTrimHeight > 0 && Object.values(edgeInsets).some(Boolean)) {
        outputBuffer = await sharp(outputBuffer)
          .extract({
            left: edgeInsets.left,
            top: edgeInsets.top,
            width: edgeTrimWidth,
            height: edgeTrimHeight
          })
          .png()
          .toBuffer()
        textOutputBuffer = await sharp(textOutputBuffer)
          .extract({
            left: edgeInsets.left,
            top: edgeInsets.top,
            width: edgeTrimWidth,
            height: edgeTrimHeight
          })
          .png()
          .toBuffer()
        edgeTrim = {
          ...edgeInsets,
          width: edgeTrimWidth,
          height: edgeTrimHeight
        }
      }

      const outputMetadata = await sharp(outputBuffer).metadata()
      const textOutputMetadata = await sharp(textOutputBuffer).metadata()

      await sharp(outputBuffer)
        .png()
        .toFile(imagePath)
      await mkdir(textKindDir, { recursive: true })
      await sharp(textOutputBuffer)
        .png()
        .toFile(textImagePath)
      const outputWidth = outputMetadata.width || cropWidth
      const outputHeight = outputMetadata.height || cropHeight
      const textOutputWidth = textOutputMetadata.width || cropWidth
      const textOutputHeight = textOutputMetadata.height || cropHeight
      const outputBounds = alphaCleanup.trim
        ? {
            x: left + alphaCleanup.trim.x + (edgeTrim?.left || 0),
            y: top + alphaCleanup.trim.y + (edgeTrim?.top || 0),
            width: outputWidth,
            height: outputHeight
          }
        : {
            x: left + (edgeTrim?.left || 0),
            y: top + (edgeTrim?.top || 0),
            width: outputWidth,
            height: outputHeight
          }
      const textOutputBounds = textAlphaCleanup.trim
        ? {
            x: left + textAlphaCleanup.trim.x + (edgeTrim?.left || 0),
            y: top + textAlphaCleanup.trim.y + (edgeTrim?.top || 0),
            width: textOutputWidth,
            height: textOutputHeight
          }
        : {
            x: left + (edgeTrim?.left || 0),
            y: top + (edgeTrim?.top || 0),
            width: textOutputWidth,
            height: textOutputHeight
          }

      items.push({
        ...item,
        image: {
          path: imagePath,
          width: outputWidth,
          height: outputHeight,
          bounds: outputBounds,
          rawBounds: {
            x: left,
            y: top,
            width: cropWidth,
            height: cropHeight
          },
          cropPadding,
          cornerRadii,
          maskRadii,
          transparentCorners: Boolean(mask),
          browserShape: useBrowserShape,
          alphaCleanup: alphaCleanup.trim
            ? {
                trim: alphaCleanup.trim,
                alphaThreshold: alphaCleanup.alphaThreshold
              }
            : null,
          edgeCleanup: edgeTrim,
          isolated: Boolean(isolatedScreenshotBuffer),
          sourceUrl: mediaSource?.sourceUrl || item.sourceUrl || '',
          sourceAsset: Boolean(mediaSource),
          innerContentHidden: shouldHideInnerContent(item),
          outerEffectsHidden: shouldHideOuterEffects(item),
          textHidden: true
        },
        textImage: {
          path: textImagePath,
          width: textOutputWidth,
          height: textOutputHeight,
          bounds: textOutputBounds,
          rawBounds: {
            x: left,
            y: top,
            width: cropWidth,
            height: cropHeight
          },
          cropPadding,
          cornerRadii,
          maskRadii,
          transparentCorners: Boolean(mask),
          browserShape: useBrowserShape,
          alphaCleanup: textAlphaCleanup.trim
            ? {
                trim: textAlphaCleanup.trim,
                alphaThreshold: textAlphaCleanup.alphaThreshold
              }
            : null,
          edgeCleanup: edgeTrim,
          sourceUrl: item.sourceUrl || '',
          sourceAsset: false,
          textHidden: false
        }
      })
    }

    const itemKindCounts = items.reduce((counts, item) => {
      counts[item.kind] = (counts[item.kind] || 0) + 1
      return counts
    }, {})

    const manifest = {
      url,
      title,
      capturedAt: new Date().toISOString(),
      viewport: { width, height },
      image: {
        path: fullPagePath,
        width: imageWidth,
        height: imageHeight
      },
      withTextImage: {
        path: withTextFullPagePath,
        width: imageWidth,
        height: imageHeight
      },
      textlessImage: {
        path: textlessPagePath,
        width: imageWidth,
        height: imageHeight
      },
      withoutTextImage: {
        path: withoutTextFullPagePath,
        width: imageWidth,
        height: imageHeight
      },
      totalBlocks: items.length,
      itemKindCounts,
      items
    }

    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    return { fullPagePath, manifestPath, totalBlocks: items.length, itemKindCounts }
  } finally {
    await page.close()
  }
}

export const capture = async (options) => {
  const url = normalizeUrl(options.url)
  const maxPages = normalizeMaxPages(options.maxPages)
  const config = await readConfig()
  const outDir = options.outDirSet ? options.outDir : config.patchPath || options.outDir
  const jobId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${slugFromUrl(url)}-${randomUUID().slice(0, 8)}`
  const outputDir = resolve(process.cwd(), outDir, jobId)
  const browser = await chromium.launch({ headless: true })

  try {
    const crawl = options.all || (!options.single && shouldCrawlByDefault(url))
    const urls = crawl ? await discoverPages(browser, url, maxPages) : [url]
    const pages = []

    for (const [index, pageUrl] of urls.entries()) {
      const pageDir = urls.length === 1 ? outputDir : join(outputDir, `page-${String(index + 1).padStart(3, '0')}-${slugFromUrl(pageUrl)}`)

      try {
        const result = await capturePage(browser, pageUrl, pageDir, options)

        pages.push({
          url: pageUrl,
          status: 'success',
          outputDir: pageDir,
          manifestPath: result.manifestPath,
          fullPagePath: result.fullPagePath,
          totalBlocks: result.totalBlocks,
          itemKindCounts: result.itemKindCounts
        })
      } catch (error) {
        pages.push({
          url: pageUrl,
          status: 'failed',
          outputDir: pageDir,
          error: error instanceof Error ? error.message : 'Unknown capture error'
        })
      }
    }

    const crawlManifestPath = join(outputDir, 'site-manifest.json')
    const siteManifest = {
      jobId,
      mode: crawl ? 'site' : 'page',
      startUrl: url,
      capturedAt: new Date().toISOString(),
      totalPages: pages.length,
      succeededPages: pages.filter((page) => page.status === 'success').length,
      failedPages: pages.filter((page) => page.status === 'failed').length,
      pages
    }

    await writeFile(crawlManifestPath, `${JSON.stringify(siteManifest, null, 2)}\n`)

    return {
      outputDir,
      manifestPath: crawlManifestPath,
      pages,
      crawl
    }
  } finally {
    await browser.close()
  }
}
