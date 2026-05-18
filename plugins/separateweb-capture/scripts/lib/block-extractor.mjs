import { MAX_ITEMS } from './constants.mjs'

export const collectBlocks = async (page) => {
  return page.evaluate((maxItems) => {
    const normalizeText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
    const hasPaint = (style) => {
      const backgroundColor = style.backgroundColor || ''
      const hasBackgroundColor = backgroundColor && !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*(?:,\s*0\s*)?\)/.test(backgroundColor) && backgroundColor !== 'transparent'
      const hasBackgroundImage = style.backgroundImage && style.backgroundImage !== 'none'
      const hasBoxShadow = style.boxShadow && style.boxShadow !== 'none'
      const hasRadius = parseFloat(style.borderRadius) > 0
      const hasOutline = parseFloat(style.outlineWidth) > 0 && style.outlineStyle && style.outlineStyle !== 'none'
      const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some((side) => {
        return parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none'
      })

      return hasBackgroundColor || hasBackgroundImage || hasBoxShadow || hasRadius || hasOutline || hasBorder
    }
    const isVisible = (element, rect, style) => {
      if (rect.width < 4 || rect.height < 4) return false
      if (style.display === 'none' || style.visibility === 'hidden') return false
      if (Number(style.opacity) === 0) return false
      if (element.getAttribute('aria-hidden') === 'true') return false
      return true
    }
    const parseRadiusPair = (value, width, height) => {
      const parts = String(value || '')
        .split(/\s+/)
        .filter(Boolean)
      const x = parts[0] || '0'
      const y = parts[1] || x
      const parse = (part, size) => {
        if (part.endsWith('%')) return size * (parseFloat(part) / 100)
        return parseFloat(part) || 0
      }

      return {
        x: parse(x, width),
        y: parse(y, height)
      }
    }
    const getCornerRadii = (style, width, height) => {
      const radii = {
        topLeft: parseRadiusPair(style.borderTopLeftRadius || style.borderRadius, width, height),
        topRight: parseRadiusPair(style.borderTopRightRadius || style.borderRadius, width, height),
        bottomRight: parseRadiusPair(style.borderBottomRightRadius || style.borderRadius, width, height),
        bottomLeft: parseRadiusPair(style.borderBottomLeftRadius || style.borderRadius, width, height)
      }

      return Object.fromEntries(
        Object.entries(radii).map(([key, value]) => [
          key,
          {
            x: Math.round(Math.max(0, value.x)),
            y: Math.round(Math.max(0, value.y))
          }
        ])
      )
    }
    const countVisualDescendants = (element) => {
      let count = 0

      for (const child of element.querySelectorAll('*')) {
        const childRect = child.getBoundingClientRect()
        const childStyle = window.getComputedStyle(child)

        if (!isVisible(child, childRect, childStyle)) continue
        if (!hasPaint(childStyle)) continue
        if (childRect.width * childRect.height < 5000) continue

        count += 1
        if (count >= 4) return count
      }

      return count
    }
    const isBackgroundShell = (element, rect, style) => {
      const tag = element.tagName.toLowerCase()
      const area = rect.width * rect.height
      const viewportArea = window.innerWidth * window.innerHeight
      const coversViewport = rect.width >= window.innerWidth * 0.94 && rect.height >= window.innerHeight * 0.9

      if ((tag === 'html' || tag === 'body') && coversViewport) return true
      if (coversViewport) return true
      return false
    }
    const isOuterUiFrame = (element, rect, style) => {
      const area = rect.width * rect.height
      const viewportArea = window.innerWidth * window.innerHeight
      const likelyAppFrame = area >= viewportArea * 0.45
        && area < viewportArea * 0.9
        && rect.width >= window.innerWidth * 0.75
        && rect.height >= window.innerHeight * 0.55

      if (!likelyAppFrame) return false
      if (!hasPaint(style)) return false

      return countVisualDescendants(element) >= 4
    }
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
    const getKind = (element, rect, style, text, hasSemanticLabel) => {
      const tag = element.tagName.toLowerCase()
      const role = element.getAttribute('role') || ''
      const className = String(element.getAttribute('class') || '').toLowerCase()
      const labelled = `${className} ${role} ${text}`.toLowerCase()
      const area = rect.width * rect.height
      const painted = hasPaint(style)
      const badgeClassOrRole = /(^|[-_\s])(badge|pill|tag|label|status)([-_\s]|$)/.test(`${className} ${role}`)
      const badgeText = /\b(ready|owned|new|offer|super offer)\b/.test(labelled)

      if (!hasSemanticLabel && tag === 'span' && !className) return 'decoration'
      if (tag === 'dialog' || role === 'dialog' || element.getAttribute('aria-modal') === 'true' || /modal|dialog|drawer|popover|sheet/.test(className)) return 'modal'
      if (tag === 'svg' || /icon|ico/.test(className)) return 'icon'
      if (tag === 'button' || role === 'button' || /(^|\s)(btn|button)(\s|$)/.test(className)) return 'button'
      if (tag === 'a') return 'link'
      if (['input', 'textarea', 'select'].includes(tag)) return 'field'
      if (tag === 'nav' || role === 'navigation') return 'navigation'
      if (tag === 'form' || role === 'form') return 'form'
      if (['img', 'canvas', 'picture', 'video'].includes(tag)) return 'media'
      if (
        (badgeClassOrRole || (painted && badgeText))
        && rect.width < 360
        && rect.height < 120
      ) return 'badge'
      if (tag === 'article' || /card|tile|product|feature|offer/.test(className)) return area > 180000 ? 'card-large' : 'card'
      if (/panel|pane|window|dialog|detail|sidebar|drawer|container/.test(className)) return area > 180000 ? 'card-large' : 'panel'
      if (isOuterUiFrame(element, rect, style)) return 'card-large'
      if (painted && area > 180000 && rect.width > 240 && rect.height > 220) return 'card-large'
      if (painted && area > 24000 && rect.width > 120 && rect.height > 80) return 'card'
      if (painted && area > 5000) return 'panel'
      if (/stat|metric|data cores|costs|score|counter/.test(labelled) && rect.width < 320 && rect.height < 180) return 'stat'
      if (/price|cost|coin|core|energy|currency|amount|\b\d+\s*\/\s*\d+\b/.test(labelled) && rect.width < 520 && rect.height < 140) return 'price'
      if (text && rect.width > 24 && rect.height > 10) return 'text'
      return 'layout'
    }
    const getPriority = (item) => {
      const weights = {
        modal: 110,
        'card-large': 105,
        card: 100,
        panel: 92,
        stat: 88,
        media: 86,
        button: 84,
        price: 82,
        badge: 80,
        navigation: 78,
        field: 76,
        link: 70,
        icon: 62,
        text: 52,
        layout: 40
      }

      return (weights[item.kind] || 0) + Math.min(item.area / 100000, 12)
    }
    const nearlySameBounds = (a, b) => {
      return Math.abs(a.bounds.x - b.bounds.x) <= 2
        && Math.abs(a.bounds.y - b.bounds.y) <= 2
        && Math.abs(a.bounds.width - b.bounds.width) <= 3
        && Math.abs(a.bounds.height - b.bounds.height) <= 3
    }
    const dedupe = (items) => {
      const kept = []

      for (const item of items) {
        if (kept.some((existing) => nearlySameBounds(existing, item) && existing.kind === item.kind)) continue
        kept.push(item)
      }

      return kept
    }

    const candidates = Array.from(document.querySelectorAll('*'))
      .map((element, index) => {
        const captureId = `block-${String(index + 1).padStart(3, '0')}`
        const rect = element.getBoundingClientRect()
        const width = Math.round(rect.width)
        const height = Math.round(rect.height)
        const style = window.getComputedStyle(element)

        if (!isVisible(element, rect, style)) return null
        if (isBackgroundShell(element, rect, style)) return null

        const rawLabel = normalizeText(
          element.getAttribute('aria-label')
          || element.getAttribute('title')
          || element.textContent
          || element.getAttribute('alt')
        )
        const label = (rawLabel || `${element.tagName.toLowerCase()} ${index + 1}`).slice(0, 96)
        const kind = getKind(element, rect, style, label, Boolean(rawLabel))
        const area = width * height
        const ownPaint = hasPaint(style)

        if (kind === 'decoration') return null
        if (kind === 'layout' && area < 120000) return null
        if (kind === 'text') return null
        if (['card-large', 'card', 'panel'].includes(kind) && !ownPaint && !isOuterUiFrame(element, rect, style)) return null

        element.setAttribute('data-separateweb-capture-id', captureId)

        return {
          id: captureId,
          captureId,
          label,
          kind,
          tagName: element.tagName,
          selector: getSelector(element),
          sourceUrl: element.currentSrc || element.src || '',
          ownPaint,
          cornerRadii: getCornerRadii(style, width, height),
          bounds: {
            x: Math.round(rect.x + window.scrollX),
            y: Math.round(rect.y + window.scrollY),
            width,
            height
          },
          area,
          priority: 0
        }
      })
      .filter(Boolean)
      .map((item) => ({ ...item, priority: getPriority(item) }))
      .sort((a, b) => b.priority - a.priority || b.area - a.area)
    const selected = dedupe(candidates).slice(0, maxItems)

    return selected
      .sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x || b.area - a.area)
      .slice(0, maxItems)
  }, MAX_ITEMS)
}
