import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { sha256 } from './artifact-utils.mjs'
import { collectBlocks } from './block-extractor.mjs'
import { DEFAULT_OUT_DIR } from './constants.mjs'
import { readConfig } from './config.mjs'
import { discoverPages } from './crawl.mjs'
import { captureAnimationPreview, collectAnimationMetadata } from './animation-capture.mjs'
import { captureItems } from './capture-items.mjs'
import { collectAccessibilityTree, collectDomSnapshot, collectDomSummary } from './dom-capture.mjs'
import { captureTextlessPage } from './image-crops.mjs'
import { buildActionManifest, buildAgentElements, collectReplayMetadata } from './manifest-builders.mjs'
import { captureScrolledFullPage, primePageForCapture } from './page-capture.mjs'
import { captureAutoStates } from './state-capture.mjs'
import {
  normalizeDimension,
  normalizeMaxPages,
  normalizeUrl,
  shouldCrawlByDefault,
  slugFromUrl
} from './url-utils.mjs'

const pageOutputPaths = (outputDir) => {
  const screenshotsDir = join(outputDir, 'screenshots')
  const cropsDir = join(outputDir, 'crops')
  const replayDir = join(outputDir, 'replay')
  const evidenceDir = join(outputDir, 'evidence')
  const animationDir = join(outputDir, 'animation')

  return {
    screenshotsDir,
    cropsDir,
    replayDir,
    evidenceDir,
    animationDir,
    itemDir: join(cropsDir, 'without-text', 'items'),
    textItemDir: join(cropsDir, 'with-text', 'items'),
    fullPagePath: join(screenshotsDir, 'full-page.png'),
    textlessPagePath: join(screenshotsDir, 'full-page.textless.png'),
    withTextFullPagePath: join(screenshotsDir, 'full-page.with-text.png'),
    withoutTextFullPagePath: join(screenshotsDir, 'full-page.without-text.png'),
    manifestPath: join(outputDir, 'manifest.json'),
    domSnapshotPath: join(replayDir, 'dom-snapshot.html'),
    rawDomSnapshotPath: join(evidenceDir, 'dom-snapshot.raw.html'),
    accessibilityTreePath: join(evidenceDir, 'accessibility-tree.json'),
    animationMetadataPath: join(animationDir, 'animation-metadata.json')
  }
}

const ensurePageDirs = async (paths) => {
  await Promise.all([
    mkdir(paths.screenshotsDir, { recursive: true }),
    mkdir(paths.itemDir, { recursive: true }),
    mkdir(paths.textItemDir, { recursive: true }),
    mkdir(paths.replayDir, { recursive: true }),
    mkdir(paths.evidenceDir, { recursive: true }),
    mkdir(paths.animationDir, { recursive: true })
  ])
}

const buildScreenshots = ({
  paths,
  imageWidth,
  imageHeight,
  screenshotBuffer,
  textlessScreenshotBuffer
}) => [
  {
    id: 'full-page',
    path: paths.fullPagePath,
    width: imageWidth,
    height: imageHeight,
    sha256: sha256(screenshotBuffer),
    textHidden: false
  },
  {
    id: 'with-text-full-page',
    path: paths.withTextFullPagePath,
    width: imageWidth,
    height: imageHeight,
    sha256: sha256(screenshotBuffer),
    textHidden: false
  },
  {
    id: 'textless-full-page',
    path: paths.textlessPagePath,
    width: imageWidth,
    height: imageHeight,
    sha256: sha256(textlessScreenshotBuffer),
    textHidden: true
  },
  {
    id: 'without-text-full-page',
    path: paths.withoutTextFullPagePath,
    width: imageWidth,
    height: imageHeight,
    sha256: sha256(textlessScreenshotBuffer),
    textHidden: true
  }
]

const buildCrops = (elements) => elements.map((element) => ({
  id: `${element.id}:crop`,
  elementId: element.id,
  semanticType: element.semanticType,
  label: element.label,
  path: element.crop.path,
  width: element.crop.width,
  height: element.crop.height,
  bbox: element.crop.bounds,
  sha256: element.crop.sha256
}))

const buildPageManifest = ({
  url,
  title,
  capturedAt,
  viewport,
  paths,
  imageWidth,
  imageHeight,
  screenshotBuffer,
  textlessScreenshotBuffer,
  itemKindCounts,
  domSummary,
  domSnapshot,
  accessibilityTree,
  animationMetadata,
  animationPreview,
  replay,
  stateCapture,
  elements,
  actions,
  crops,
  items
}) => ({
  schemaVersion: '2.0.0',
  captureKind: 'agent-ready-ui',
  url,
  title,
  capturedAt,
  viewport,
  pages: [
    {
      id: 'page-001',
      url,
      title,
      screenshotId: 'full-page',
      totalBlocks: items.length,
      itemKindCounts
    }
  ],
  image: {
    path: paths.fullPagePath,
    width: imageWidth,
    height: imageHeight,
    sha256: sha256(screenshotBuffer)
  },
  withTextImage: {
    path: paths.withTextFullPagePath,
    width: imageWidth,
    height: imageHeight,
    sha256: sha256(screenshotBuffer)
  },
  textlessImage: {
    path: paths.textlessPagePath,
    width: imageWidth,
    height: imageHeight,
    sha256: sha256(textlessScreenshotBuffer)
  },
  withoutTextImage: {
    path: paths.withoutTextFullPagePath,
    width: imageWidth,
    height: imageHeight,
    sha256: sha256(textlessScreenshotBuffer)
  },
  screenshots: buildScreenshots({
    paths,
    imageWidth,
    imageHeight,
    screenshotBuffer,
    textlessScreenshotBuffer
  }),
  domSummary,
  domSnapshot,
  accessibilityTree,
  animationMetadata,
  animationPreview,
  replay,
  states: stateCapture,
  elements,
  actions,
  crops,
  totalBlocks: items.length,
  itemKindCounts,
  items
})

export const capturePage = async (browser, url, outputDir, options) => {
  const width = normalizeDimension(options.width, '--width')
  const height = normalizeDimension(options.height, '--height')
  const viewport = { width, height }
  const paths = pageOutputPaths(outputDir)

  await ensurePageDirs(paths)

  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1
  })

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined)

    const capturedAt = new Date().toISOString()
    const title = await page.title()
    const animationPreview = await captureAnimationPreview(page, paths.animationDir, viewport)

    await page.reload({
      waitUntil: 'domcontentloaded',
      timeout: 45000
    }).catch(() => undefined)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined)

    const animationMetadata = await collectAnimationMetadata(page, paths.animationMetadataPath, viewport)
    await primePageForCapture(page, height)

    const domSummary = await collectDomSummary(page)
    const domSnapshot = await collectDomSnapshot(page, paths.domSnapshotPath, paths.rawDomSnapshotPath)
    const accessibilityTree = await collectAccessibilityTree(page, paths.accessibilityTreePath)
    const scrolledScreenshot = await captureScrolledFullPage(page, paths.fullPagePath, width, height)
    const screenshotBuffer = scrolledScreenshot.buffer

    await writeFile(paths.withTextFullPagePath, screenshotBuffer)

    const rawItems = await collectBlocks(page)
    const textlessScreenshotBuffer = await captureTextlessPage(page, paths.textlessPagePath)

    await writeFile(paths.withoutTextFullPagePath, textlessScreenshotBuffer)

    const imageWidth = scrolledScreenshot.width || width
    const imageHeight = scrolledScreenshot.height || height
    const items = await captureItems({
      page,
      rawItems,
      itemDir: paths.itemDir,
      textItemDir: paths.textItemDir,
      screenshotBuffer,
      textlessScreenshotBuffer,
      imageWidth,
      imageHeight
    })
    const itemKindCounts = items.reduce((counts, item) => {
      counts[item.kind] = (counts[item.kind] || 0) + 1
      return counts
    }, {})
    const elements = buildAgentElements(items)
    const actions = buildActionManifest(elements)
    const stateCapture = await captureAutoStates(page, items, outputDir, { ...options, ...viewport })
    const replay = await collectReplayMetadata(browser, page, capturedAt, { ...options, ...viewport }, imageWidth, imageHeight)
    const crops = buildCrops(elements)
    const manifest = buildPageManifest({
      url,
      title,
      capturedAt,
      viewport,
      paths,
      imageWidth,
      imageHeight,
      screenshotBuffer,
      textlessScreenshotBuffer,
      itemKindCounts,
      domSummary,
      domSnapshot,
      accessibilityTree,
      animationMetadata,
      animationPreview,
      replay,
      stateCapture,
      elements,
      actions,
      crops,
      items
    })

    await writeFile(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    return {
      fullPagePath: paths.fullPagePath,
      manifestPath: paths.manifestPath,
      totalBlocks: items.length,
      itemKindCounts
    }
  } finally {
    await page.close()
  }
}

export const capture = async (options) => {
  const url = normalizeUrl(options.url)
  const maxPages = normalizeMaxPages(options.maxPages)
  const config = await readConfig()
  const outDir = options.outDirSet ? options.outDir : config.patchPath || options.outDir || DEFAULT_OUT_DIR
  const jobId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${slugFromUrl(url)}-${randomUUID().slice(0, 8)}`
  const outputDir = resolve(process.cwd(), outDir, jobId)
  const browser = await chromium.launch({ headless: true })

  try {
    const crawl = options.all || (!options.single && shouldCrawlByDefault(url))
    const urls = crawl ? await discoverPages(browser, url, maxPages) : [url]
    const pages = []

    for (const [index, pageUrl] of urls.entries()) {
      const pageDir = urls.length === 1
        ? outputDir
        : join(outputDir, 'pages', `page-${String(index + 1).padStart(3, '0')}-${slugFromUrl(pageUrl)}`)

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
