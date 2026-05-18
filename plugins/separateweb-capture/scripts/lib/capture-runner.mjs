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

export const capturePage = async (browser, url, outputDir, options) => {
  const width = normalizeDimension(options.width, '--width')
  const height = normalizeDimension(options.height, '--height')
  const itemDir = join(outputDir, 'items')
  const fullPagePath = join(outputDir, 'full-page.png')
  const textlessPagePath = join(outputDir, 'full-page-textless.png')
  const manifestPath = join(outputDir, 'manifest.json')

  await mkdir(itemDir, { recursive: true })

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

    const title = await page.title()
    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      path: fullPagePath
    })
    const metadata = await sharp(screenshotBuffer).metadata()
    const rawItems = await collectBlocks(page)
    const textlessScreenshotBuffer = await captureTextlessPage(page, textlessPagePath)
    const imageWidth = metadata.width || width
    const imageHeight = metadata.height || height
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
      const imageName = `${String(index + 1).padStart(3, '0')}-${item.id}-${item.kind}.png`
      const imagePath = join(kindDir, imageName)
      const mediaSource = await readMediaSource(item)
      const isolatedScreenshotBuffer = await captureIsolatedItemPage(page, item)
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

      let outputBuffer = await crop
        .png()
        .toBuffer()
      const alphaCleanup = useBrowserShape
        ? await cleanupAlphaHalo(outputBuffer, alphaCleanupThreshold(item))
        : {
            buffer: outputBuffer,
            trim: null,
            alphaThreshold: null
          }

      outputBuffer = alphaCleanup.buffer
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
        edgeTrim = {
          ...edgeInsets,
          width: edgeTrimWidth,
          height: edgeTrimHeight
        }
      }

      const outputMetadata = await sharp(outputBuffer).metadata()

      await sharp(outputBuffer)
        .png()
        .toFile(imagePath)
      const outputWidth = outputMetadata.width || cropWidth
      const outputHeight = outputMetadata.height || cropHeight
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
      textlessImage: {
        path: textlessPagePath,
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
