#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { chromium } from 'playwright'
import sharp from 'sharp'

const DEFAULT_VIEWPORT = { width: 1440, height: 1000 }
const DEFAULT_OUT_DIR = 'captures'
const CONFIG_DIR = join(homedir(), '.separateweb-capture')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')
const MAX_ITEMS = 80
const DEFAULT_MAX_PAGES = 20

const usage = () => {
  console.log(`Usage:
  separateweb capture <url> [--out <dir>] [--width <px>] [--height <px>] [--max-pages <n>] [--single|--all]
  separateweb patch <dir>
  separateweb patch --clear
  separateweb select <manifest.json>
  separateweb create <manifest.json> --items <indexes> --path <dir>
  node scripts/capture.mjs capture <url>

Example:
  separateweb patch /Users/onecrop/Desktop/patches
  separateweb capture https://demo.separateweb.dev/
  separateweb capture https://demo.separateweb.dev/orbit-store --single
  separateweb select captures/<jobId>/manifest.json
  separateweb create captures/<jobId>/manifest.json --items 1,3,5 --path /Users/onecrop/Desktop/patches`)
}

const fail = (message, code = 1) => {
  console.error(`Error: ${message}`)
  process.exit(code)
}

const parseArgs = (argv) => {
  const [command, rawTarget, ...rest] = argv
  const options = {
    command,
    target: rawTarget,
    url: rawTarget,
    outDir: DEFAULT_OUT_DIR,
    outDirSet: false,
    items: '',
    width: DEFAULT_VIEWPORT.width,
    height: DEFAULT_VIEWPORT.height,
    maxPages: DEFAULT_MAX_PAGES,
    all: argv.includes('--all'),
    single: argv.includes('--single'),
    clear: argv.includes('--clear'),
    help: argv.includes('--help') || argv.includes('-h')
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    const next = rest[index + 1]

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    if (arg === '--out') {
      if (!next) fail('--out requires a directory')
      options.outDir = next
      options.outDirSet = true
      index += 1
      continue
    }

    if (arg === '--path') {
      if (!next) fail('--path requires a directory')
      options.outDir = next
      options.outDirSet = true
      index += 1
      continue
    }

    if (arg === '--clear') {
      options.clear = true
      continue
    }

    if (arg === '--all') {
      options.all = true
      continue
    }

    if (arg === '--single') {
      options.single = true
      continue
    }

    if (arg === '--max-pages') {
      if (!next) fail('--max-pages requires a number')
      options.maxPages = Number(next)
      index += 1
      continue
    }

    if (arg === '--items') {
      if (!next) fail('--items requires indexes, for example 1,3,5')
      options.items = next
      index += 1
      continue
    }

    if (arg === '--width') {
      if (!next) fail('--width requires a number')
      options.width = Number(next)
      index += 1
      continue
    }

    if (arg === '--height') {
      if (!next) fail('--height requires a number')
      options.height = Number(next)
      index += 1
      continue
    }

    fail(`Unknown option: ${arg}`)
  }

  return options
}

const normalizeUrl = (value) => {
  if (!value) fail('URL is required')

  let url

  try {
    url = new URL(value)
  } catch {
    fail('Invalid URL')
  }

  if (!['http:', 'https:', 'file:'].includes(url.protocol)) {
    fail('Only http, https, and file URLs are supported')
  }

  return url.toString()
}

const normalizeDimension = (value, name) => {
  if (!Number.isFinite(value) || value < 320 || value > 10000) {
    fail(`${name} must be a number between 320 and 10000`)
  }

  return Math.floor(value)
}

const normalizeMaxPages = (value) => {
  if (!Number.isFinite(value) || value < 1 || value > 200) {
    fail('--max-pages must be a number between 1 and 200')
  }

  return Math.floor(value)
}

const readConfig = async () => {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  } catch {
    return {}
  }
}

const writeConfig = async (config) => {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`)
}

const showPatchPath = async () => {
  const config = await readConfig()

  console.log(`Config: ${CONFIG_PATH}`)
  console.log(`Patch path: ${config.patchPath || '(not set)'}`)
}

const setPatchPath = async (targetPath) => {
  if (!targetPath) fail('patch path is required')

  const patchPath = resolve(process.cwd(), targetPath)
  const config = {
    ...(await readConfig()),
    patchPath
  }

  await mkdir(patchPath, { recursive: true })
  await writeConfig(config)

  console.log(`Config: ${CONFIG_PATH}`)
  console.log(`Patch path: ${patchPath}`)
}

const clearPatchPath = async () => {
  const config = await readConfig()

  delete config.patchPath
  await writeConfig(config)

  console.log(`Config: ${CONFIG_PATH}`)
  console.log('Patch path: (not set)')
}

const readManifest = async (manifestPath) => {
  if (!manifestPath) fail('manifest.json path is required')

  try {
    return JSON.parse(await readFile(resolve(process.cwd(), manifestPath), 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown manifest read error'
    fail(`Cannot read manifest: ${message}`)
  }
}

const formatItemLine = (item, index) => {
  const bounds = item.bounds
    ? `${item.bounds.width}x${item.bounds.height}+${item.bounds.x}+${item.bounds.y}`
    : 'unknown-bounds'
  const label = item.label || item.selector || item.id || 'untitled'

  return `${index + 1}. [${item.kind}] ${label} (${bounds})`
}

const listManifestItems = async (manifestPath) => {
  const manifest = await readManifest(manifestPath)
  const items = Array.isArray(manifest.items) ? manifest.items : []

  console.log(`Manifest: ${resolve(process.cwd(), manifestPath)}`)
  console.log(`URL: ${manifest.url || ''}`)
  console.log(`Blocks: ${items.length}`)

  items.forEach((item, index) => {
    console.log(formatItemLine(item, index))
  })
}

const parseItemIndexes = (value, max) => {
  if (!value) fail('--items is required, for example --items 1,3,5')
  if (value === 'all') {
    return Array.from({ length: max }, (_, index) => index)
  }

  const indexes = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((index) => Number.isInteger(index))

  if (!indexes.length) fail('--items must contain indexes, for example 1,3,5')

  const unique = [...new Set(indexes)]

  unique.forEach((index) => {
    if (index < 1 || index > max) {
      fail(`Item index out of range: ${index}`)
    }
  })

  return unique.map((index) => index - 1)
}

const resolveManifestAssetPath = (manifestPath, imagePath) => {
  if (!imagePath) return ''
  if (imagePath.startsWith('/')) return imagePath

  return resolve(dirname(resolve(process.cwd(), manifestPath)), imagePath)
}

const createPatch = async (options) => {
  const manifestPath = options.target
  const manifest = await readManifest(manifestPath)
  const items = Array.isArray(manifest.items) ? manifest.items : []
  const selectedIndexes = parseItemIndexes(options.items, items.length)
  const outputRoot = options.outDir === DEFAULT_OUT_DIR ? 'patches' : options.outDir
  const patchId = `${manifest.jobId || 'patch'}-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const outputDir = resolve(process.cwd(), outputRoot, patchId)
  const assetDir = join(outputDir, 'items')
  const selectedItems = []

  await mkdir(assetDir, { recursive: true })

  for (const selectedIndex of selectedIndexes) {
    const item = items[selectedIndex]
    const sourceImagePath = resolveManifestAssetPath(manifestPath, item.image?.path)
    const kindDir = join(assetDir, item.kind || 'unknown')
    const imageName = `${String(selectedIndex + 1).padStart(3, '0')}-${item.id || `item-${selectedIndex + 1}`}.png`
    const imagePath = join(kindDir, imageName)

    await mkdir(kindDir, { recursive: true })
    if (sourceImagePath) {
      await copyFile(sourceImagePath, imagePath)
    }

    selectedItems.push({
      index: selectedIndex + 1,
      ...item,
      image: {
        ...item.image,
        path: imagePath
      }
    })
  }

  const patchManifestPath = join(outputDir, 'patch.json')
  const patchManifest = {
    patchId,
    sourceManifest: resolve(process.cwd(), manifestPath),
    sourceUrl: manifest.url || '',
    createdAt: new Date().toISOString(),
    totalItems: selectedItems.length,
    items: selectedItems
  }

  await writeFile(patchManifestPath, `${JSON.stringify(patchManifest, null, 2)}\n`)

  return {
    outputDir,
    patchManifestPath,
    totalItems: selectedItems.length
  }
}

const slugFromUrl = (url) => {
  const parsed = new URL(url)
  const pathName = parsed.pathname.replace(/\/+$/, '')
  const raw = basename(pathName) || parsed.hostname

  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'capture'
}

const normalizePageUrl = (href) => {
  const url = new URL(href)
  url.hash = ''
  url.search = ''

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  return url.toString()
}

const shouldCrawlByDefault = (url) => {
  const parsed = new URL(url)

  return ['http:', 'https:'].includes(parsed.protocol)
    && (parsed.pathname === '/' || parsed.pathname === '')
    && !parsed.search
}

const shouldSkipCrawlPath = (url) => {
  return /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|mp4|mp3|webm|css|js|json|xml|txt)(?:$|[?#])/i.test(url.pathname)
}

const safeFetchText = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/xml,text/xml,text/plain,*/*'
      }
    })

    if (!response.ok) return ''

    return response.text()
  } catch {
    return ''
  }
}

const discoverSitemapPages = async (startUrl, maxPages) => {
  const start = new URL(startUrl)
  const robots = await safeFetchText(new URL('/robots.txt', start.origin).toString())
  const sitemapUrls = [
    new URL('/sitemap.xml', start.origin).toString(),
    ...robots
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^sitemap:/i.test(line))
      .map((line) => line.replace(/^sitemap:\s*/i, ''))
  ]
  const pages = []
  const seen = new Set()

  for (const sitemapUrl of sitemapUrls) {
    if (pages.length >= maxPages || seen.has(sitemapUrl)) continue
    seen.add(sitemapUrl)

    const xml = await safeFetchText(sitemapUrl)

    for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
      let normalized

      try {
        normalized = normalizePageUrl(match[1].trim())
      } catch {
        continue
      }

      const parsed = new URL(normalized)

      if (parsed.origin !== start.origin || shouldSkipCrawlPath(parsed)) continue
      if (!pages.includes(normalized)) pages.push(normalized)
      if (pages.length >= maxPages) break
    }
  }

  return pages
}

const discoverPages = async (browser, startUrl, maxPages) => {
  const start = new URL(startUrl)
  const queue = [normalizePageUrl(start.toString())]
  const queued = new Set(queue)
  const visited = []

  const addUrl = (href) => {
    let normalized

    try {
      normalized = normalizePageUrl(href)
    } catch {
      return
    }

    const parsed = new URL(normalized)

    if (parsed.origin !== start.origin || shouldSkipCrawlPath(parsed)) return
    if (visited.includes(normalized) || queued.has(normalized)) return
    if (visited.length + queue.length >= maxPages) return

    queue.push(normalized)
    queued.add(normalized)
  }

  ;(await discoverSitemapPages(startUrl, maxPages)).forEach(addUrl)

  while (queue.length && visited.length < maxPages) {
    const currentUrl = queue.shift()

    if (!currentUrl || visited.includes(currentUrl)) continue

    queued.delete(currentUrl)
    visited.push(currentUrl)

    const page = await browser.newPage({
      viewport: DEFAULT_VIEWPORT,
      deviceScaleFactor: 1
    })

    try {
      await page.goto(currentUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      })
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)

      const hrefs = await page.evaluate(() => {
        return [
          ...Array.from(document.links).map((link) => link.href),
          ...Array.from(document.querySelectorAll('form[action]')).map((form) => form.action)
        ].filter(Boolean)
      })

      hrefs.forEach(addUrl)
    } catch {
      // Keep discovered pages even if one page fails during discovery.
    } finally {
      await page.close()
    }
  }

  return visited.length ? visited : [normalizePageUrl(startUrl)]
}

const collectBlocks = async (page) => {
  return page.evaluate((maxItems) => {
    const selectors = [
      'dialog',
      '[aria-modal="true"]',
      '[role="dialog"]',
      'header',
      'nav',
      'main',
      'section',
      'article',
      'aside',
      'footer',
      'form',
      'button',
      'a',
      'input',
      'textarea',
      'select',
      'img',
      'svg',
      '[class*="card" i]',
      '[class*="panel" i]',
      '[class*="tile" i]',
      '[class*="product" i]',
      '[class*="feature" i]',
      '[class*="hero" i]'
    ].join(',')

    const normalizeText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
    const getSelector = (element) => {
      const id = element.getAttribute('id')
      const className = String(element.getAttribute('class') || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .join('.')

      if (id) return `${element.tagName.toLowerCase()}#${id}`
      if (className) return `${element.tagName.toLowerCase()}.${className}`
      return element.tagName.toLowerCase()
    }
    const getKind = (element) => {
      const tag = element.tagName.toLowerCase()
      const role = element.getAttribute('role') || ''
      const className = String(element.getAttribute('class') || '').toLowerCase()

      if (tag === 'dialog' || role === 'dialog' || element.getAttribute('aria-modal') === 'true' || /modal|dialog|drawer|popover|sheet/.test(className)) return 'modal'
      if (tag === 'svg' || /icon|ico/.test(className)) return 'icon'
      if (tag === 'button' || role === 'button' || /(^|\s)(btn|button)(\s|$)/.test(className)) return 'button'
      if (tag === 'a') return 'link'
      if (['input', 'textarea', 'select'].includes(tag)) return 'field'
      if (tag === 'nav' || role === 'navigation') return 'navigation'
      if (tag === 'form' || role === 'form') return 'form'
      if (tag === 'img') return 'media'
      if (tag === 'article' || /card|panel|tile|product|feature/.test(className)) return 'card'
      return 'layout'
    }

    return Array.from(document.querySelectorAll(selectors))
      .map((element, index) => {
        const rect = element.getBoundingClientRect()
        const width = Math.round(rect.width)
        const height = Math.round(rect.height)

        if (width < 8 || height < 8) return null

        const label = normalizeText(
          element.getAttribute('aria-label')
          || element.getAttribute('title')
          || element.textContent
          || element.getAttribute('alt')
          || `${element.tagName.toLowerCase()} ${index + 1}`
        ).slice(0, 96)

        return {
          id: `block-${String(index + 1).padStart(3, '0')}`,
          label,
          kind: getKind(element),
          tagName: element.tagName,
          selector: getSelector(element),
          bounds: {
            x: Math.round(rect.x + window.scrollX),
            y: Math.round(rect.y + window.scrollY),
            width,
            height
          },
          area: width * height
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.area - a.area)
      .slice(0, maxItems)
  }, MAX_ITEMS)
}

const capturePage = async (browser, url, outputDir, options) => {
  const width = normalizeDimension(options.width, '--width')
  const height = normalizeDimension(options.height, '--height')
  const itemDir = join(outputDir, 'items')
  const fullPagePath = join(outputDir, 'full-page.png')
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
    const imageWidth = metadata.width || width
    const imageHeight = metadata.height || height
    const items = []

    for (const [index, item] of rawItems.entries()) {
      const left = Math.max(0, Math.floor(item.bounds.x))
      const top = Math.max(0, Math.floor(item.bounds.y))
      const cropWidth = Math.min(imageWidth - left, Math.ceil(item.bounds.width))
      const cropHeight = Math.min(imageHeight - top, Math.ceil(item.bounds.height))

      if (cropWidth < 1 || cropHeight < 1) continue

      const kindDir = join(itemDir, item.kind)
      const imageName = `${String(index + 1).padStart(3, '0')}-${item.id}-${item.kind}.png`
      const imagePath = join(kindDir, imageName)

      await mkdir(kindDir, { recursive: true })
      await sharp(screenshotBuffer)
        .extract({
          left,
          top,
          width: cropWidth,
          height: cropHeight
        })
        .png()
        .toFile(imagePath)

      items.push({
        ...item,
        image: {
          path: imagePath,
          width: cropWidth,
          height: cropHeight
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

const capture = async (options) => {
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

const main = async () => {
  const options = parseArgs(process.argv.slice(2))

  if (options.help || !options.command) {
    usage()
    return
  }

  if (options.command === 'select') {
    await listManifestItems(options.target)
    return
  }

  if (options.command === 'patch') {
    if (options.clear) {
      await clearPatchPath()
      return
    }

    if (!options.target) {
      await showPatchPath()
      return
    }

    if (options.items || options.target.endsWith('.json')) {
      fail('Use `create <manifest.json> --items <indexes> --path <dir>` to export selected manifest items.')
    }

    await setPatchPath(options.target)
    return
  }

  if (options.command === 'create') {
    const result = await createPatch(options)

    console.log(`Patch: ${result.patchManifestPath}`)
    console.log(`Output: ${result.outputDir}`)
    console.log(`Items: ${result.totalItems}`)
    return
  }

  if (options.command !== 'capture') {
    fail(`Unknown command: ${options.command}`)
  }

  const result = await capture(options)

  console.log(`Captured: ${result.outputDir}`)
  console.log(`Manifest: ${result.manifestPath}`)
  console.log(`Pages: ${result.pages.length}`)
  console.log(`Succeeded: ${result.pages.filter((page) => page.status === 'success').length}`)
  console.log(`Failed: ${result.pages.filter((page) => page.status === 'failed').length}`)
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'Capture failed')
})
