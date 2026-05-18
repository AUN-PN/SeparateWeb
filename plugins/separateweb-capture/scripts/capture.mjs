#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { chromium } from 'playwright'
import sharp from 'sharp'

const DEFAULT_VIEWPORT = { width: 1440, height: 1000 }
const DEFAULT_OUT_DIR = 'captures'
const MAX_ITEMS = 80

const usage = () => {
  console.log(`Usage:
  separateweb capture <url> [--out <dir>] [--width <px>] [--height <px>]
  node scripts/capture.mjs capture <url>

Example:
  separateweb capture https://demo.separateweb.dev/orbit-store`)
}

const fail = (message, code = 1) => {
  console.error(`Error: ${message}`)
  process.exit(code)
}

const parseArgs = (argv) => {
  const [command, rawUrl, ...rest] = argv
  const options = {
    command,
    url: rawUrl,
    outDir: DEFAULT_OUT_DIR,
    width: DEFAULT_VIEWPORT.width,
    height: DEFAULT_VIEWPORT.height,
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

const capture = async (options) => {
  const url = normalizeUrl(options.url)
  const width = normalizeDimension(options.width, '--width')
  const height = normalizeDimension(options.height, '--height')
  const jobId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${slugFromUrl(url)}-${randomUUID().slice(0, 8)}`
  const outputDir = resolve(process.cwd(), options.outDir, jobId)
  const itemDir = join(outputDir, 'items')
  const fullPagePath = join(outputDir, 'full-page.png')
  const manifestPath = join(outputDir, 'manifest.json')

  await mkdir(itemDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({
      viewport: { width, height },
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

      const imageName = `${String(index + 1).padStart(3, '0')}-${item.id}-${item.kind}.png`
      const imagePath = join(itemDir, imageName)

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

    const manifest = {
      jobId,
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
      items
    }

    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    return { fullPagePath, manifestPath, totalBlocks: items.length }
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

  if (options.command !== 'capture') {
    fail(`Unknown command: ${options.command}`)
  }

  const result = await capture(options)

  console.log(`Captured: ${result.fullPagePath}`)
  console.log(`Manifest: ${result.manifestPath}`)
  console.log(`Blocks: ${result.totalBlocks}`)
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'Capture failed')
})
