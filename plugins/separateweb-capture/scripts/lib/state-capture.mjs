import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { sha256 } from './artifact-utils.mjs'
import { primePageForCapture } from './page-capture.mjs'

const getStateHash = async (page) => {
  const state = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    text: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 12000),
    htmlLength: document.documentElement.outerHTML.length,
    dialogs: document.querySelectorAll('dialog,[role="dialog"],[aria-modal="true"]').length,
    expanded: Array.from(document.querySelectorAll('[aria-expanded="true"]')).map((element) => element.textContent?.trim().slice(0, 80) || element.tagName)
  })).catch(() => ({ url: page.url() }))

  return sha256(JSON.stringify(state))
}

const stateCandidateScore = (item) => {
  const haystack = [
    item.label,
    item.kind,
    item.semanticType,
    item.aria?.role,
    item.dom?.id,
    ...(item.dom?.classList || [])
  ].join(' ').toLowerCase()
  let score = 0

  if (item.aria?.expanded !== null && item.aria?.expanded !== undefined) score += 20
  if (item.aria?.selected !== null && item.aria?.selected !== undefined) score += 12
  if (['tab', 'switch', 'checkbox'].includes(item.aria?.role)) score += 18
  if (/tab|menu|filter|dropdown|accordion|toggle|expand|more|open|faq|modal|drawer/.test(haystack)) score += 16
  if (item.semanticType === 'navigation') score += 6

  return score
}

const canProbeState = (item) => {
  const tagName = item.dom?.tagName || String(item.tagName || '').toLowerCase()
  const type = String(item.dom?.attributes?.type || '').toLowerCase()
  const actions = item.actions || []

  if (!actions.includes('click') && !actions.includes('toggle')) return false
  if (tagName === 'a') return false
  if (['submit', 'reset', 'file'].includes(type)) return false

  return stateCandidateScore(item) > 0
}

export const captureAutoStates = async (page, items, outputDir, options) => {
  if (options.states !== 'auto') {
    return { mode: 'off', totalStates: 0, states: [] }
  }

  const limit = Math.max(0, Math.min(Number(options.stateLimit) || 5, 20))
  const stateDir = join(outputDir, 'states')
  const baseHash = await getStateHash(page)
  const seen = new Set([baseHash])
  const states = []
  const errors = []
  const candidates = items
    .filter(canProbeState)
    .sort((a, b) => stateCandidateScore(b) - stateCandidateScore(a) || b.area - a.area)
    .slice(0, limit * 3)

  if (!limit || !candidates.length) {
    return { mode: 'auto', totalStates: 0, candidateCount: candidates.length, states, errors }
  }

  await mkdir(stateDir, { recursive: true })

  for (const item of candidates) {
    if (states.length >= limit) break

    const selector = item.selectors?.captureId || `[data-separateweb-capture-id="${item.captureId}"]`
    const beforeUrl = page.url()

    try {
      const locator = page.locator(selector).first()
      await locator.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => undefined)
      await locator.click({ timeout: 1800, noWaitAfter: true })
      await page.waitForTimeout(700)

      if (page.url() !== beforeUrl) {
        errors.push({
          elementId: item.id,
          reason: 'skipped-navigation',
          beforeUrl,
          afterUrl: page.url()
        })
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => undefined)
        await primePageForCapture(page, options.height).catch(() => undefined)
        continue
      }

      const stateHash = await getStateHash(page)
      if (seen.has(stateHash)) {
        await page.keyboard.press('Escape').catch(() => undefined)
        continue
      }

      seen.add(stateHash)
      const stateIndex = states.length + 1
      const screenshotPath = join(stateDir, `state-${String(stateIndex).padStart(3, '0')}-${item.id}.png`)
      const screenshotBuffer = await page.screenshot({ fullPage: false })
      const metadata = await sharp(screenshotBuffer).metadata()

      await writeFile(screenshotPath, screenshotBuffer)
      states.push({
        id: `state-${String(stateIndex).padStart(3, '0')}`,
        url: page.url(),
        stateHash,
        triggeredBy: {
          elementId: item.id,
          label: item.label,
          semanticType: item.semanticType,
          action: item.actions?.includes('toggle') ? 'toggle' : 'click',
          selector
        },
        screenshot: {
          path: screenshotPath,
          width: metadata.width || options.width,
          height: metadata.height || options.height,
          sha256: sha256(screenshotBuffer)
        }
      })
      await page.keyboard.press('Escape').catch(() => undefined)
    } catch (error) {
      errors.push({
        elementId: item.id,
        reason: error instanceof Error ? error.message : 'state capture failed'
      })
    }
  }

  return {
    mode: 'auto',
    limit,
    candidateCount: candidates.length,
    totalStates: states.length,
    states,
    errors
  }
}
