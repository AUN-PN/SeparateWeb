import { MAX_ITEMS } from './constants.mjs'

export const collectBlocks = async (page) => {
  return page.evaluate((maxItems) => {
    const normalizeText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
    const escapeCss = (value) => {
      if (window.CSS?.escape) return window.CSS.escape(value)
      return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
    }
    const getAttributeMap = (element) => {
      const allowed = new Set([
        'aria-controls',
        'aria-expanded',
        'aria-haspopup',
        'aria-label',
        'aria-modal',
        'aria-selected',
        'alt',
        'data-cy',
        'data-test',
        'data-testid',
        'href',
        'id',
        'name',
        'placeholder',
        'title',
        'type',
        'value'
      ])
      const attributes = {}

      for (const attribute of element.attributes) {
        if (!allowed.has(attribute.name)) continue
        if (attribute.value.length > 160) continue
        attributes[attribute.name] = attribute.value
      }

      return attributes
    }
    const getAriaRole = (element) => {
      const explicitRole = element.getAttribute('role')
      const tag = element.tagName.toLowerCase()
      const type = String(element.getAttribute('type') || '').toLowerCase()

      if (explicitRole) return explicitRole
      if (tag === 'a' && element.getAttribute('href')) return 'link'
      if (tag === 'button') return 'button'
      if (tag === 'input' && ['button', 'submit', 'reset'].includes(type)) return 'button'
      if (tag === 'input' && type === 'checkbox') return 'checkbox'
      if (tag === 'input' && type === 'radio') return 'radio'
      if (tag === 'input' || tag === 'textarea') return 'textbox'
      if (tag === 'select') return 'combobox'
      if (tag === 'img') return 'img'
      if (tag === 'nav') return 'navigation'
      if (tag === 'form') return 'form'
      if (tag === 'header') return 'banner'
      if (tag === 'footer') return 'contentinfo'
      if (tag === 'main') return 'main'
      if (/^h[1-6]$/.test(tag)) return 'heading'
      return ''
    }
    const getAccessibleName = (element) => {
      const labelledBy = element.getAttribute('aria-labelledby')

      if (labelledBy) {
        const labelledText = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || '')
          .join(' ')
        if (normalizeText(labelledText)) return labelledText
      }

      if (element.labels?.length) {
        const labelText = Array.from(element.labels).map((label) => label.textContent || '').join(' ')
        if (normalizeText(labelText)) return labelText
      }

      return element.getAttribute('aria-label')
        || element.getAttribute('alt')
        || element.getAttribute('title')
        || element.getAttribute('placeholder')
        || element.getAttribute('value')
        || element.textContent
        || ''
    }
    const getXPath = (element) => {
      const parts = []
      let current = element

      while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
        const tag = current.tagName.toLowerCase()
        const siblings = Array.from(current.parentElement?.children || []).filter((sibling) => sibling.tagName === current.tagName)
        const index = siblings.length > 1 ? `[${siblings.indexOf(current) + 1}]` : ''
        parts.unshift(`${tag}${index}`)
        current = current.parentElement
      }

      return `/html/${parts.join('/')}`
    }
    const getSelector = (element) => {
      const id = element.getAttribute('id')
      const testId = element.getAttribute('data-testid') || element.getAttribute('data-test') || element.getAttribute('data-cy')
      const className = String(element.getAttribute('class') || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map(escapeCss)
        .join('.')

      if (testId) return `[data-testid="${testId}"], [data-test="${testId}"], [data-cy="${testId}"]`
      if (id) return `${element.tagName.toLowerCase()}#${escapeCss(id)}`
      if (className) return `${element.tagName.toLowerCase()}.${className}`
      return element.tagName.toLowerCase()
    }
    const getSelectorCandidates = (element, captureId, cssSelector, role, label) => {
      const id = element.getAttribute('id')
      const testId = element.getAttribute('data-testid') || element.getAttribute('data-test') || element.getAttribute('data-cy')
      const shortLabel = normalizeText(label).slice(0, 120)

      return {
        captureId: `[data-separateweb-capture-id="${captureId}"]`,
        css: cssSelector,
        id: id ? `#${escapeCss(id)}` : '',
        testId: testId ? `[data-testid="${testId}"], [data-test="${testId}"], [data-cy="${testId}"]` : '',
        role: role && shortLabel ? `getByRole("${role}", { name: "${shortLabel.replace(/"/g, '\\"')}" })` : '',
        text: shortLabel && shortLabel.length <= 80 ? `text="${shortLabel.replace(/"/g, '\\"')}"` : '',
        xpath: getXPath(element)
      }
    }
    const isScrollable = (element) => {
      const style = window.getComputedStyle(element)
      const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`
      const hasScrollableOverflow = /(auto|scroll)/.test(overflow)

      return hasScrollableOverflow && (
        element.scrollHeight > element.clientHeight + 8
        || element.scrollWidth > element.clientWidth + 8
      )
    }
    const getActions = (element, role) => {
      const tag = element.tagName.toLowerCase()
      const type = String(element.getAttribute('type') || '').toLowerCase()
      const actions = new Set()

      if (
        tag === 'button'
        || (tag === 'a' && element.getAttribute('href'))
        || element.getAttribute('onclick')
        || ['button', 'link', 'menuitem', 'tab', 'option'].includes(role)
        || element.getAttribute('aria-expanded') !== null
        || tag === 'summary'
      ) actions.add('click')

      if (
        tag === 'textarea'
        || element.getAttribute('contenteditable') === 'true'
        || (tag === 'input' && !['button', 'checkbox', 'file', 'hidden', 'image', 'radio', 'reset', 'submit'].includes(type))
        || role === 'textbox'
      ) actions.add('fill')

      if (tag === 'select' || ['combobox', 'listbox'].includes(role)) actions.add('select')
      if (['checkbox', 'radio', 'switch'].includes(role) || (tag === 'input' && ['checkbox', 'radio'].includes(type))) actions.add('toggle')
      if (actions.size || element.matches(':hover')) actions.add('hover')
      if (isScrollable(element)) actions.add('scroll')

      return Array.from(actions)
    }
    const getSemanticType = (element, kind, text, role) => {
      const tag = element.tagName.toLowerCase()
      const className = String(element.getAttribute('class') || '').toLowerCase()
      const id = String(element.getAttribute('id') || '').toLowerCase()
      const labelled = `${id} ${className} ${role} ${text}`.toLowerCase()
      const rect = element.getBoundingClientRect()
      const nearTop = rect.top + window.scrollY < window.innerHeight * 0.9

      if (tag === 'header' || role === 'banner' || /(^|[-_\s])header([-_\s]|$)/.test(labelled)) return 'header'
      if (tag === 'nav' || role === 'navigation') return 'navigation'
      if (tag === 'footer' || role === 'contentinfo') return 'footer'
      if (kind === 'modal' || /modal|dialog|drawer|popover|sheet/.test(labelled)) return 'modal'
      if (tag === 'form' || role === 'form') return 'form'
      if (/pricing|price|plan|billing|subscription/.test(labelled)) return 'pricing'
      if (/testimonial|review|quote|customer story|case study/.test(labelled)) return 'testimonial'
      if (/faq|question|accordion/.test(labelled)) return 'faq'
      if (/feature|benefit|capability/.test(labelled)) return 'feature'
      if (/hero|headline|above[-_\s]?fold/.test(labelled) || (nearTop && /h1|headline|trial|demo|start|signup|sign up/.test(labelled) && rect.width > 360)) return 'hero'
      if (kind === 'button' && /trial|demo|start|buy|subscribe|contact|signup|sign up|get started|learn more/.test(labelled)) return 'cta'
      if (['card', 'card-large', 'panel'].includes(kind)) return 'section'
      return kind
    }
    const hasPaint = (style) => {
      const backgroundColor = style.backgroundColor || ''
      const hasBackgroundColor = backgroundColor && !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*(?:,\s*0\s*)?\)/.test(backgroundColor) && backgroundColor !== 'transparent'
      const hasBackgroundImage = style.backgroundImage && style.backgroundImage !== 'none'
      const hasBoxShadow = style.boxShadow && style.boxShadow !== 'none'
      const hasOutline = parseFloat(style.outlineWidth) > 0 && style.outlineStyle && style.outlineStyle !== 'none'
      const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some((side) => {
        return parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none'
      })

      return hasBackgroundColor || hasBackgroundImage || hasBoxShadow || hasOutline || hasBorder
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
    const hasRenderableDescendant = (element) => {
      return Boolean(element.querySelector('img,svg,canvas,picture,video,input,textarea,select,button,a,[role]'))
    }
    const isPaintOnlyDecoration = (element, rect, style, rawLabel) => {
      const tag = element.tagName.toLowerCase()
      const className = String(element.getAttribute('class') || '').toLowerCase()

      if (rawLabel) return false
      if (!['div', 'span'].includes(tag)) return false
      if (element.currentSrc || element.src) return false
      if (hasRenderableDescendant(element)) return false
      if (/blur|gradient|glow|orb|background|decoration|absolute|rounded-full/.test(className)) return true
      if (style.position === 'absolute' || style.position === 'fixed') return true
      if (rect.width <= 72 && rect.height <= 72) return true
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
        if (isPaintOnlyDecoration(element, rect, style, rawLabel)) return null

        const role = getAriaRole(element)
        const accessibleName = normalizeText(getAccessibleName(element)).slice(0, 160)
        const label = (rawLabel || accessibleName || `${element.tagName.toLowerCase()} ${index + 1}`).slice(0, 96)
        const kind = getKind(element, rect, style, label, Boolean(rawLabel))
        const area = width * height
        const ownPaint = hasPaint(style)
        const cssSelector = getSelector(element)

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
          semanticType: getSemanticType(element, kind, label, role),
          tagName: element.tagName,
          selector: cssSelector,
          selectors: getSelectorCandidates(element, captureId, cssSelector, role, label),
          actions: getActions(element, role),
          aria: {
            role,
            name: accessibleName || label,
            expanded: element.getAttribute('aria-expanded'),
            selected: element.getAttribute('aria-selected'),
            controls: element.getAttribute('aria-controls'),
            hidden: element.getAttribute('aria-hidden') === 'true'
          },
          dom: {
            tagName: element.tagName.toLowerCase(),
            id: element.getAttribute('id') || '',
            classList: String(element.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 12),
            attributes: getAttributeMap(element),
            text: normalizeText(element.textContent || '').slice(0, 240)
          },
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
