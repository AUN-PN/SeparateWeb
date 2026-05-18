import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'
import sharp from 'sharp'
import type {
  UiBlockAttributes,
  UiBlockImage,
  UiBlockKind,
  UiLayerImage,
  UiLayerKind,
  UiBlockState,
  UiBounds,
  UiCrawlPageResult,
  UiCrawlResult,
  UiExtractionResult,
  UiKindCount
} from '#shared/types/ui-extraction'
import { createCollectUiCandidatesScript } from './ui-extraction/dom-extractor'

const MAX_BLOCKS = 120
const MAX_CARD_PARTS = 32
const DEFAULT_CRAWL_MAX_PAGES = 8
const HARD_CRAWL_MAX_PAGES = 20
const VIEWPORT = { width: 1440, height: 1000 }
const KIND_ORDER = ['modal', 'card', 'button', 'link', 'field', 'icon', 'form', 'navigation', 'layout', 'media', 'content'] as const
const TRANSPARENT_ORIGINAL_KINDS = new Set<UiBlockKind>(['button', 'link', 'field', 'icon', 'content', 'media'])

const publicRoot = () => join(process.cwd(), 'public')

const clampBounds = (bounds: UiBounds, imageWidth: number, imageHeight: number) => {
  const x = Math.max(0, Math.floor(bounds.x))
  const y = Math.max(0, Math.floor(bounds.y))
  const width = Math.min(imageWidth - x, Math.ceil(bounds.width))
  const height = Math.min(imageHeight - y, Math.ceil(bounds.height))

  return { x, y, width, height }
}

const publicAssetUrl = (jobId: string, fileName: string) => `/exports/${jobId}/${fileName}`

const errorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Unknown extraction error'
}

const normalizeCrawlUrl = (href: string) => {
  const url = new URL(href)
  url.hash = ''

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  return url.toString()
}

const normalizeCrawlLimit = (maxPages?: number) => {
  if (!Number.isFinite(maxPages)) {
    return DEFAULT_CRAWL_MAX_PAGES
  }

  return Math.max(1, Math.min(HARD_CRAWL_MAX_PAGES, Math.floor(maxPages || DEFAULT_CRAWL_MAX_PAGES)))
}

const safeFetchText = async (url: string) => {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/xml,text/xml,text/plain,*/*'
      }
    })

    if (!response.ok) {
      return ''
    }

    return response.text()
  } catch {
    return ''
  }
}

const extractSitemapLocs = (xml: string) => {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean)
}

const extractRobotSitemaps = (robots: string) => {
  return robots
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^sitemap:/i.test(line))
    .map((line) => line.replace(/^sitemap:\s*/i, '').trim())
    .filter(Boolean)
}

const discoverSitemapUrls = async (start: URL, maxPages: number) => {
  const sitemapCandidates = new Set<string>([
    new URL('/sitemap.xml', start.origin).toString()
  ])
  const robots = await safeFetchText(new URL('/robots.txt', start.origin).toString())

  extractRobotSitemaps(robots).forEach((sitemapUrl) => {
    sitemapCandidates.add(sitemapUrl)
  })

  const pageUrls: string[] = []
  const seenSitemaps = new Set<string>()
  const pendingSitemaps = Array.from(sitemapCandidates)

  while (pendingSitemaps.length > 0 && pageUrls.length < maxPages) {
    const sitemapUrl = pendingSitemaps.shift()

    if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) {
      continue
    }

    seenSitemaps.add(sitemapUrl)

    const xml = await safeFetchText(sitemapUrl)

    if (!xml) {
      continue
    }

    for (const loc of extractSitemapLocs(xml)) {
      let normalized: string

      try {
        normalized = normalizeCrawlUrl(loc)
      } catch {
        continue
      }

      const parsed = new URL(normalized)

      if (parsed.origin !== start.origin || !['http:', 'https:'].includes(parsed.protocol)) {
        continue
      }

      if (/\.xml(?:$|[?#])/i.test(parsed.pathname)) {
        pendingSitemaps.push(normalized)
        continue
      }

      if (!pageUrls.includes(normalized)) {
        pageUrls.push(normalized)
      }

      if (pageUrls.length >= maxPages) {
        break
      }
    }
  }

  return pageUrls
}

const discoverReachablePages = async (browser: Browser, startUrl: string, maxPages: number) => {
  const start = new URL(startUrl)
  const queue = [normalizeCrawlUrl(start.toString())]
  const queued = new Set(queue)
  const visited: string[] = []
  const addToQueue = (href: string) => {
    let nextUrl: string

    try {
      nextUrl = normalizeCrawlUrl(href)
    } catch {
      return
    }

    const parsed = new URL(nextUrl)

    if (parsed.origin !== start.origin || !['http:', 'https:'].includes(parsed.protocol)) {
      return
    }

    if (!visited.includes(nextUrl) && !queued.has(nextUrl) && queue.length + visited.length < maxPages) {
      queue.push(nextUrl)
      queued.add(nextUrl)
    }
  }

  const sitemapUrls = await discoverSitemapUrls(start, maxPages)
  sitemapUrls.forEach(addToQueue)

  while (queue.length > 0 && visited.length < maxPages) {
    const currentUrl = queue.shift()

    if (!currentUrl) {
      continue
    }

    queued.delete(currentUrl)

    if (visited.includes(currentUrl)) {
      continue
    }

    visited.push(currentUrl)

    const page = await browser.newPage({
      viewport: VIEWPORT,
      deviceScaleFactor: 1
    })

    try {
      await page.goto(currentUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)

      const links = await page.evaluate(() => {
        return [
          ...Array.from(document.links).map((link) => link.href),
          ...Array.from(document.querySelectorAll('form[action]')).map((form) => {
            return (form as HTMLFormElement).action
          })
        ].filter(Boolean)
      })

      for (const href of links) {
        addToQueue(href)
      }
    } catch {
      // Discovery should still return the pages already found.
    } finally {
      await page.close()
    }
  }

  return visited
}

const layerFileName = (index: number, id: string, layerKind: UiLayerKind) => {
  return `${String(index + 1).padStart(3, '0')}-${id}-${layerKind}.png`
}

const layerLabel = (kind: UiLayerKind) => {
  const labels: Record<UiLayerKind, string> = {
    original: 'Original',
    background: 'Background',
    'card-surface': 'Card only',
    'card-info': 'Info only',
    'card-part': 'Card part',
    'icon-transparent': 'Transparent icon'
  }

  return labels[kind]
}

const emptyAttributes = (): UiBlockAttributes => ({
  role: '',
  type: '',
  name: '',
  href: '',
  ariaLabel: '',
  title: '',
  classes: [],
  text: ''
})

const emptyState = (): UiBlockState => ({
  disabled: false,
  hasIcon: false,
  hasText: false,
  isModalCandidate: false
})

const punchTransparentRects = async (inputPath: string, outputPath: string, rects: UiBounds[]) => {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  rects.forEach((rect) => {
    const left = Math.max(0, Math.floor(rect.x))
    const top = Math.max(0, Math.floor(rect.y))
    const right = Math.min(info.width, Math.ceil(rect.x + rect.width))
    const bottom = Math.min(info.height, Math.ceil(rect.y + rect.height))

    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        data[(y * info.width + x) * info.channels + 3] = 0
      }
    }
  })

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  })
    .png()
    .toFile(outputPath)
}

const capturePageBackgroundLayer = async (page: Page, outputPath: string, cutoutBounds: UiBounds[] = []) => {
  const styleId = 'separate-web-page-background-layer'
  const rawOutputPath = cutoutBounds.length ? outputPath.replace(/\.png$/, '-raw.png') : outputPath
  const css = `
    html,
    body {
      min-height: 100% !important;
    }

    body * {
      visibility: hidden !important;
      color: transparent !important;
      text-shadow: none !important;
      -webkit-text-fill-color: transparent !important;
    }

    body,
    body > main,
    body > main > [class*="shell" i],
    body > main > [class*="screen" i],
    body > main > [class*="shell" i] > [class*="screen" i] {
      visibility: visible !important;
    }

    body > main > [class*="screen" i],
    body > main > [class*="shell" i] > [class*="screen" i] {
      background: transparent !important;
      border-color: transparent !important;
      box-shadow: none !important;
      outline-color: transparent !important;
    }

    body > main > [class*="screen" i]::before,
    body > main > [class*="screen" i]::after,
    body > main > [class*="shell" i] > [class*="screen" i]::before,
    body > main > [class*="shell" i] > [class*="screen" i]::after {
      opacity: 0 !important;
    }

    body > main > [class*="screen" i] > *,
    body > main > [class*="shell" i] > [class*="screen" i] > * {
      visibility: hidden !important;
    }

    body > main > [class*="screen" i] > [class*="background" i],
    body > main > [class*="screen" i] > [class*="backdrop" i],
    body > main > [class*="screen" i] > [class*="bg" i],
    body > main > [class*="screen" i] > [class*="star" i],
    body > main > [class*="screen" i] > [class*="planet" i],
    body > main > [class*="screen" i] > [class*="space" i],
    body > main > [class*="screen" i] > [class*="decor" i],
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="background" i],
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="backdrop" i],
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="bg" i],
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="star" i],
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="planet" i],
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="space" i],
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="decor" i],
    body > main > [class*="screen" i] > [class*="background" i] *,
    body > main > [class*="screen" i] > [class*="backdrop" i] *,
    body > main > [class*="screen" i] > [class*="bg" i] *,
    body > main > [class*="screen" i] > [class*="star" i] *,
    body > main > [class*="screen" i] > [class*="planet" i] *,
    body > main > [class*="screen" i] > [class*="space" i] *,
    body > main > [class*="screen" i] > [class*="decor" i] *,
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="background" i] *,
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="backdrop" i] *,
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="bg" i] *,
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="star" i] *,
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="planet" i] *,
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="space" i] *,
    body > main > [class*="shell" i] > [class*="screen" i] > [class*="decor" i] * {
      visibility: visible !important;
    }

    header,
    nav,
    aside,
    article,
    form,
    button,
    input,
    textarea,
    select,
    img,
    svg,
    [data-separate-web-text="true"],
    [class*="card" i],
    [class*="panel" i],
    [class*="dock" i],
    [class*="offer" i],
    [class*="product" i],
    [class*="preview" i],
    [class*="tabs" i],
    [class*="topbar" i],
    [class*="reward" i],
    [class*="button" i],
    [class*="pill" i],
    [class*="chip" i],
    [class*="ribbon" i],
    [class*="terms" i] {
      visibility: hidden !important;
    }
  `

  await page.evaluate(({ id, text }) => {
    const style = document.createElement('style')
    style.id = id
    style.textContent = text
    document.head.append(style)
  }, { id: styleId, text: css })

  try {
    const buffer = await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      omitBackground: false,
      timeout: 10000
    })

    await sharp(buffer)
      .ensureAlpha()
      .png()
      .toFile(rawOutputPath)

    if (cutoutBounds.length) {
      await punchTransparentRects(rawOutputPath, outputPath, cutoutBounds)
      await rm(rawOutputPath, { force: true })
    }
  } finally {
    await page.evaluate((id) => {
      document.getElementById(id)?.remove()
    }, styleId)
  }
}

const captureDomLayer = async (
  page: Page,
  domId: string,
  outputPath: string,
  layerKind: Exclude<UiLayerKind, 'original' | 'background'>,
  visiblePartDomId = ''
) => {
  const styleId = `separate-web-layer-${domId}-${layerKind}`
  const target = `[data-separate-web-id="${domId}"]`
  const partTarget = visiblePartDomId ? `[data-separate-web-part-id="${visiblePartDomId}"]` : target
  const cssByLayer: Record<Exclude<UiLayerKind, 'original' | 'background'>, string> = {
    'card-surface': `
      ${target} * {
        visibility: hidden !important;
      }

      ${target},
      ${target}::before,
      ${target}::after {
        color: transparent !important;
        text-shadow: none !important;
        -webkit-text-fill-color: transparent !important;
      }
    `,
    'card-info': `
      html,
      body {
        background: transparent !important;
      }

      body * {
        visibility: hidden !important;
      }

      ${target},
      ${target} * {
        visibility: visible !important;
      }

      ${target} {
        background: transparent !important;
        border-color: transparent !important;
        box-shadow: none !important;
        outline-color: transparent !important;
      }
    `,
    'card-part': `
      html,
      body {
        background: transparent !important;
      }

      body * {
        visibility: hidden !important;
      }

      ${target} {
        visibility: visible !important;
        background: transparent !important;
        border-color: transparent !important;
        box-shadow: none !important;
        outline-color: transparent !important;
      }

      ${target}::before,
      ${target}::after {
        opacity: 0 !important;
      }

      ${partTarget},
      ${partTarget} * {
        visibility: visible !important;
        opacity: 1 !important;
      }
    `,
    'icon-transparent': `
      html,
      body {
        background: transparent !important;
      }

      body * {
        visibility: hidden !important;
      }

      ${target},
      ${target} * {
        visibility: visible !important;
      }

      ${target},
      ${target} * {
        background: transparent !important;
        box-shadow: none !important;
      }
    `
  }

  await page.evaluate(({ id, css }) => {
    const style = document.createElement('style')
    style.id = id
    style.textContent = css
    document.head.append(style)
  }, { id: styleId, css: cssByLayer[layerKind] })

  try {
    const buffer = await page
      .locator(target)
      .first()
      .screenshot({
        animations: 'disabled',
        omitBackground: layerKind !== 'card-surface',
        timeout: 10000
      })

    await sharp(buffer)
      .ensureAlpha()
      .png()
      .toFile(outputPath)
  } finally {
    await page.evaluate((id) => {
      document.getElementById(id)?.remove()
    }, styleId)
  }
}

const captureIsolatedElementLayer = async (page: Page, domId: string, outputPath: string) => {
  const styleId = `separate-web-isolated-${domId}`
  const target = `[data-separate-web-id="${domId}"]`
  const css = `
    html,
    body {
      background: transparent !important;
    }

    body * {
      visibility: hidden !important;
    }

    ${target},
    ${target} * {
      visibility: visible !important;
    }
  `

  await page.evaluate(({ id, text }) => {
    const style = document.createElement('style')
    style.id = id
    style.textContent = text
    document.head.append(style)
  }, { id: styleId, text: css })

  try {
    const buffer = await page
      .locator(target)
      .first()
      .screenshot({
        animations: 'disabled',
        omitBackground: true,
        timeout: 10000
      })

    await sharp(buffer)
      .ensureAlpha()
      .png()
      .toFile(outputPath)
  } finally {
    await page.evaluate((id) => {
      document.getElementById(id)?.remove()
    }, styleId)
  }
}

const cropOpaqueOriginalLayer = async (
  screenshotBuffer: Buffer,
  outputPath: string,
  bounds: UiBounds
) => {
  await sharp(screenshotBuffer)
    .extract({
      left: bounds.x,
      top: bounds.y,
      width: bounds.width,
      height: bounds.height
    })
    .png()
    .toFile(outputPath)
}

export const extractUiFromUrl = async (url: string): Promise<UiExtractionResult> => {
  const jobId = randomUUID()
  const exportDir = join(publicRoot(), 'exports', jobId)
  const fullPageFile = 'full-page.png'
  const fullPagePath = join(exportDir, fullPageFile)

  await mkdir(exportDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({
      viewport: VIEWPORT,
      deviceScaleFactor: 1
    })

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
    const imageWidth = metadata.width || VIEWPORT.width
    const imageHeight = metadata.height || VIEWPORT.height
    const backgroundFileName = layerFileName(0, 'page-background', 'background')
    const backgroundOutputPath = join(exportDir, backgroundFileName)

    const extraction = await page.evaluate(({ options, script }) => {
      return new Function('options', script)(options)
    }, {
      options: {
        maxBlocks: MAX_BLOCKS,
        maxCardParts: MAX_CARD_PARTS
      },
      script: createCollectUiCandidatesScript()
    })

    const foregroundCutouts = extraction.blocks
      .filter((block) => {
        const selector = block.selector.toLowerCase()
        const isBackgroundDecor = selector.includes('starfield')
          || selector.includes('orbit-planet')
          || selector.includes('background')
          || selector.includes('backdrop')

        return !isBackgroundDecor
          && ['card', 'modal', 'navigation', 'form'].includes(block.kind)
      })
      .map((block) => block.bounds)

    let backgroundItem: UiBlockImage | null = null

    try {
      await capturePageBackgroundLayer(page, backgroundOutputPath, foregroundCutouts)
      backgroundItem = {
        id: `${jobId}-page-background`,
        label: 'Page background',
        kind: 'layout',
        tagName: 'BODY',
        selector: 'body',
        parentSelector: '',
        imageUrl: publicAssetUrl(jobId, backgroundFileName),
        bounds: {
          x: 0,
          y: 0,
          width: imageWidth,
          height: imageHeight
        },
        attributes: emptyAttributes(),
        state: emptyState(),
        area: imageWidth * imageHeight,
        depth: 0,
        layers: [
          {
            kind: 'background',
            label: layerLabel('background'),
            imageUrl: publicAssetUrl(jobId, backgroundFileName),
            transparent: foregroundCutouts.length > 0
          }
        ]
      }
    } catch {
      // Background capture is best-effort because some pages paint everything in a single image/canvas.
    }

    const items: UiBlockImage[] = backgroundItem ? [backgroundItem] : []

    for (const [index, candidate] of extraction.blocks.entries()) {
      const bounds = clampBounds(candidate.bounds, imageWidth, imageHeight)

      if (bounds.width < 1 || bounds.height < 1) {
        continue
      }

      const fileName = layerFileName(index, candidate.id, 'original')
      const outputPath = join(exportDir, fileName)
      const originalIsTransparent = TRANSPARENT_ORIGINAL_KINDS.has(candidate.kind)
      const layers: UiLayerImage[] = [
        {
          kind: 'original',
          label: layerLabel('original'),
          imageUrl: publicAssetUrl(jobId, fileName),
          transparent: originalIsTransparent
        }
      ]

      if (originalIsTransparent) {
        try {
          await captureIsolatedElementLayer(page, candidate.domId, outputPath)
        } catch {
          await cropOpaqueOriginalLayer(screenshotBuffer, outputPath, bounds)
          layers[0].transparent = false
        }
      } else {
        await cropOpaqueOriginalLayer(screenshotBuffer, outputPath, bounds)
      }

      const extraLayerKinds: Array<Exclude<UiLayerKind, 'original' | 'background'>> = []

      if (candidate.kind === 'card' || candidate.kind === 'modal') {
        extraLayerKinds.push('card-surface', 'card-info')
      }

      if (candidate.kind === 'icon') {
        extraLayerKinds.push('icon-transparent')
      }

      for (const layerKind of extraLayerKinds) {
        const extraFileName = layerFileName(index, candidate.id, layerKind)
        const extraOutputPath = join(exportDir, extraFileName)

        try {
          await captureDomLayer(page, candidate.domId, extraOutputPath, layerKind)
          layers.push({
            kind: layerKind,
            label: layerLabel(layerKind),
            imageUrl: publicAssetUrl(jobId, extraFileName),
            transparent: layerKind !== 'card-surface'
          })
        } catch {
          // Layer capture is best-effort because some sites mutate nodes after load.
        }
      }

      if (candidate.kind === 'card') {
        for (const [partIndex, part] of candidate.parts.entries()) {
          const partFileName = layerFileName(index, `${candidate.id}-${part.id}`, 'card-part')
          const partOutputPath = join(exportDir, partFileName)

          try {
            await captureDomLayer(page, candidate.domId, partOutputPath, 'card-part', part.domId)
            layers.push({
              kind: 'card-part',
              label: `Part ${partIndex + 1}: ${part.label}`,
              imageUrl: publicAssetUrl(jobId, partFileName),
              transparent: true,
              selector: part.selector,
              text: part.label,
              bounds: part.bounds
            })
          } catch {
            // Individual card parts are best-effort for animated or virtualized nodes.
          }
        }
      }

      const { domId, parts, ...publicCandidate } = candidate

      items.push({
        ...publicCandidate,
        id: `${jobId}-${candidate.id}`,
        bounds,
        area: bounds.width * bounds.height,
        imageUrl: publicAssetUrl(jobId, fileName),
        layers
      })
    }

    const categoryCounts = KIND_ORDER
      .map<UiKindCount>((kind) => ({
        kind,
        count: items.filter((item) => item.kind === kind).length
      }))
      .filter((entry) => entry.count > 0)

    return {
      jobId,
      url,
      title,
      origin: new URL(url).origin,
      capturedAt: new Date().toISOString(),
      fullPageImageUrl: `/exports/${jobId}/${fullPageFile}`,
      totalBlocks: items.length,
      hiddenModalCount: extraction.hiddenModalCount,
      categoryCounts,
      items
    }
  } catch (error) {
    await rm(exportDir, { recursive: true, force: true })
    throw error
  } finally {
    await browser.close()
  }
}

export const crawlAndExtractUiFromUrl = async (url: string, maxPages?: number): Promise<UiCrawlResult> => {
  const pageLimit = normalizeCrawlLimit(maxPages)
  const discoveryBrowser = await chromium.launch({ headless: true })

  let urls: string[]

  try {
    urls = await discoverReachablePages(discoveryBrowser, url, pageLimit)
  } finally {
    await discoveryBrowser.close()
  }

  if (!urls.length) {
    urls = [normalizeCrawlUrl(url)]
  }

  const pages: UiCrawlPageResult[] = []

  for (const pageUrl of urls) {
    try {
      pages.push({
        url: pageUrl,
        status: 'success',
        result: await extractUiFromUrl(pageUrl),
        error: ''
      })
    } catch (error) {
      pages.push({
        url: pageUrl,
        status: 'failed',
        result: null,
        error: errorMessage(error)
      })
    }
  }

  const succeededPages = pages.filter((page) => page.status === 'success').length

  return {
    mode: 'crawl',
    startUrl: url,
    origin: new URL(url).origin,
    capturedAt: new Date().toISOString(),
    totalPages: pages.length,
    succeededPages,
    failedPages: pages.length - succeededPages,
    pages
  }
}
