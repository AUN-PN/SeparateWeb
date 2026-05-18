import { DEFAULT_VIEWPORT } from './constants.mjs'
import { normalizePageUrl, shouldSkipCrawlPath } from './url-utils.mjs'

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

export const discoverPages = async (browser, startUrl, maxPages) => {
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
