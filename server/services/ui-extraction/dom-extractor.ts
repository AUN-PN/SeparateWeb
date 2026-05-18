import type {
  UiBlockAttributes,
  UiBlockKind,
  UiBlockState,
  UiBounds
} from '#shared/types/ui-extraction'

export interface CandidatePart {
  id: string
  label: string
  selector: string
  domId: string
  bounds: UiBounds
}

export interface CandidateBlock {
  id: string
  label: string
  kind: UiBlockKind
  tagName: string
  selector: string
  parentSelector: string
  domId: string
  bounds: UiBounds
  attributes: UiBlockAttributes
  state: UiBlockState
  area: number
  depth: number
  parts: CandidatePart[]
}

interface CollectUiCandidatesOptions {
  maxBlocks: number
  maxCardParts: number
}

interface PickedPart extends CandidatePart {
  area: number
  rect: DOMRect
}

interface PickedBlock extends CandidateBlock {
  rect: DOMRect
}

const ELEMENT_SELECTOR = [
  'header',
  'nav',
  'main',
  'section',
  'article',
  'aside',
  'footer',
  'form',
  'dialog',
  '[popover]',
  '[aria-modal="true"]',
  '[role="dialog"]',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="main"]',
  '[role="form"]',
  '[role="button"]',
  'article',
  '[class]',
  'button',
  '[class*="button" i]',
  '[class*="btn" i]',
  'a',
  'input',
  'textarea',
  'select',
  'summary',
  'svg',
  'i',
  'figure',
  'img',
  'body > *',
  '[class*="container" i]',
  '[class*="content" i]',
  '[class*="card" i]',
  '[class*="panel" i]',
  '[class*="tile" i]',
  '[class*="product" i]',
  '[class*="feature" i]',
  '[class*="dialog" i]',
  '[class*="drawer" i]',
  '[class*="modal" i]',
  '[class*="popover" i]',
  '[class*="sheet" i]',
  '[class*="icon" i]',
  '[class*="ico" i]',
  '[class*="hero" i]',
  '[class*="banner" i]',
  '[class*="toolbar" i]'
].join(',')

const MODAL_SELECTOR = [
  'dialog',
  '[popover]',
  '[aria-modal="true"]',
  '[role="dialog"]',
  '[class*="dialog" i]',
  '[class*="drawer" i]',
  '[class*="modal" i]',
  '[class*="popover" i]',
  '[class*="sheet" i]'
].join(',')

const PART_SELECTOR = [
  '[data-separate-web-text="true"]',
  'svg',
  'img',
  'button',
  'input',
  'textarea',
  'select',
  'span'
].join(',')

const KIND_ORDER: UiBlockKind[] = ['modal', 'card', 'button', 'link', 'field', 'icon', 'form', 'navigation', 'layout', 'media', 'content']
const DETAIL_KINDS = new Set<UiBlockKind>(['modal', 'card', 'button', 'link', 'field', 'icon'])

const normalizeText = (value?: string | null) => value?.replace(/\s+/g, ' ').trim() || ''

const colorHasVisibleAlpha = (value: string) => {
  if (!value || value === 'transparent') return false

  const match = value.match(/rgba?\(([^)]+)\)/)

  if (!match) return true

  const parts = match[1].split(',').map((part) => part.trim())
  const alpha = parts.length >= 4 ? Number(parts[3]) : 1

  return Number.isNaN(alpha) ? true : alpha > 0.04
}

const numericStyle = (value: string) => {
  const parsed = Number.parseFloat(value)

  return Number.isNaN(parsed) ? 0 : parsed
}

const wrapTextNodes = () => {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement
        const text = normalizeText(node.textContent)

        if (!parent || !text) return NodeFilter.FILTER_REJECT
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'SVG'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT
        if (parent.closest('[data-separate-web-text="true"]')) return NodeFilter.FILTER_REJECT

        return NodeFilter.FILTER_ACCEPT
      }
    }
  )
  const nodes: Text[] = []
  let cursor = walker.nextNode()

  while (cursor) {
    nodes.push(cursor as Text)
    cursor = walker.nextNode()
  }

  nodes.forEach((node, index) => {
    const span = document.createElement('span')
    span.setAttribute('data-separate-web-text', 'true')
    span.setAttribute('data-separate-web-text-index', String(index + 1))
    span.textContent = node.textContent
    node.replaceWith(span)
  })
}

const isCardSurface = (element: Element, styles: CSSStyleDeclaration, rect: DOMRect) => {
  const tag = element.tagName.toLowerCase()
  const className = String(element.getAttribute('class') || '').toLowerCase()
  const area = rect.width * rect.height
  const namedSurface = /card|panel|tile|product|feature|metric|terminal|node|topbar|canvas|visual|board|rail|window|screen|frame|stage|viewport|step|surface|box/.test(className)
  const screenSurface = /screen|frame|stage|viewport/.test(className)
  const hasBorder = numericStyle(styles.borderTopWidth) > 0
    || numericStyle(styles.borderRightWidth) > 0
    || numericStyle(styles.borderBottomWidth) > 0
    || numericStyle(styles.borderLeftWidth) > 0
  const hasRadius = numericStyle(styles.borderTopLeftRadius) > 4
    || numericStyle(styles.borderTopRightRadius) > 4
    || numericStyle(styles.borderBottomRightRadius) > 4
    || numericStyle(styles.borderBottomLeftRadius) > 4
  const hasBackground = colorHasVisibleAlpha(styles.backgroundColor) || styles.backgroundImage !== 'none'
  const hasShadow = styles.boxShadow !== 'none'
  const reasonableSize = rect.width >= 54
    && rect.height >= 24
    && rect.width <= (screenSurface ? window.innerWidth * 0.98 : Math.min(window.innerWidth * 0.9, 900))
    && rect.height <= (screenSurface ? window.innerHeight * 0.98 : Math.min(window.innerHeight * 0.9, 760))
    && area >= 1200

  if (['html', 'body', 'main'].includes(tag)) return false
  if (!reasonableSize) return false

  return namedSurface || ((hasBackground || hasBorder || hasShadow) && hasRadius)
}

const getKind = (element: Element, styles: CSSStyleDeclaration, rect: DOMRect): UiBlockKind => {
  const tag = element.tagName.toLowerCase()
  const role = element.getAttribute('role') || ''
  const className = String(element.getAttribute('class') || '').toLowerCase()
  const inputType = element instanceof HTMLInputElement ? element.type : ''

  if (tag === 'dialog' || role === 'dialog' || element.getAttribute('aria-modal') === 'true' || element.hasAttribute('popover') || /modal|dialog|drawer|popover|sheet/.test(className)) return 'modal'
  if (tag === 'svg' || tag === 'i' || /icon|ico/.test(className)) return 'icon'
  if (tag === 'button' || role === 'button' || ['button', 'submit', 'reset'].includes(inputType) || /(^|\s)(btn|button|clickable)(\s|$)/.test(className) || tag === 'summary') return 'button'
  if (tag === 'a') return 'link'
  if (['input', 'textarea', 'select'].includes(tag)) return 'field'
  if (tag === 'nav' || role === 'navigation') return 'navigation'
  if (tag === 'form' || role === 'form') return 'form'
  if (tag === 'img' || tag === 'figure') return 'media'
  if (tag === 'article' || isCardSurface(element, styles, rect)) return 'card'
  if (['header', 'main', 'section', 'article', 'aside', 'footer'].includes(tag)) return 'layout'
  return 'content'
}

const getLabel = (element: Element, index: number) => {
  const ariaLabel = element.getAttribute('aria-label')
  const readableText = element instanceof HTMLElement ? element.innerText : element.textContent
  const title = element.getAttribute('title')
  const inputValue = element instanceof HTMLInputElement ? element.value || element.placeholder : ''
  const fallback = `${element.tagName.toLowerCase()} ${index + 1}`

  return (ariaLabel || title || inputValue || normalizeText(readableText) || fallback).slice(0, 96)
}

const getSelector = (element: Element) => {
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

const getDepth = (element: Element) => {
  let depth = 0
  let cursor = element.parentElement

  while (cursor) {
    depth += 1
    cursor = cursor.parentElement
  }

  return depth
}

const getAttributes = (element: Element): UiBlockAttributes => {
  const readableText = element instanceof HTMLElement ? element.innerText : element.textContent
  const href = element instanceof HTMLAnchorElement ? element.href : ''
  const type = element instanceof HTMLInputElement || element instanceof HTMLButtonElement ? element.type : ''
  const name = element instanceof HTMLInputElement || element instanceof HTMLButtonElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement ? element.name : ''

  return {
    role: element.getAttribute('role') || '',
    type,
    name,
    href,
    ariaLabel: element.getAttribute('aria-label') || '',
    title: element.getAttribute('title') || '',
    classes: String(element.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 8),
    text: normalizeText(readableText).slice(0, 160)
  }
}

const getState = (element: Element, kind: UiBlockKind): UiBlockState => {
  const disabled = element instanceof HTMLButtonElement
    || element instanceof HTMLInputElement
    || element instanceof HTMLSelectElement
    || element instanceof HTMLTextAreaElement
    ? element.disabled
    : element.getAttribute('aria-disabled') === 'true'
  const text = normalizeText(element.textContent).replace(/\s+/g, '')

  return {
    disabled,
    hasIcon: Boolean(element.querySelector('svg,i,[class*="icon" i],[class*="ico" i]')),
    hasText: text.length > 0,
    isModalCandidate: kind === 'modal'
  }
}

const isVisible = (styles: CSSStyleDeclaration) => {
  return styles.display !== 'none' && styles.visibility !== 'hidden' && Number(styles.opacity) !== 0
}

const isContainedBy = (a: DOMRect, b: DOMRect) => {
  return a.x >= b.x
    && a.y >= b.y
    && a.right <= b.right
    && a.bottom <= b.bottom
}

const isDuplicatePart = (pickedParts: PickedPart[], rect: DOMRect) => {
  return pickedParts.some((picked) => {
    const sameSize = Math.abs(picked.rect.width - rect.width) < 3 && Math.abs(picked.rect.height - rect.height) < 3
    const samePlace = Math.abs(picked.rect.x - rect.x) < 3 && Math.abs(picked.rect.y - rect.y) < 3

    return sameSize && samePlace
  })
}

const getLayerParts = (element: Element, cardRect: DOMRect, cardDomId: string, maxCardParts: number) => {
  const pickedParts: PickedPart[] = []
  const parts = Array.from(element.querySelectorAll(PART_SELECTOR))

  parts.forEach((part, partIndex) => {
    if (part === element) return

    const styles = window.getComputedStyle(part)
    const rect = part.getBoundingClientRect()
    const width = Math.round(rect.width)
    const height = Math.round(rect.height)
    const area = width * height
    const text = normalizeText(part.textContent)
    const tagName = part.tagName.toLowerCase()
    const isWrappedText = part.getAttribute('data-separate-web-text') === 'true'
    const isGraphic = ['svg', 'img'].includes(tagName)
    const isControl = ['button', 'input', 'textarea', 'select'].includes(tagName)
    const isShape = !text
      && tagName === 'span'
      && area >= 20
      && area <= 4096
      && colorHasVisibleAlpha(styles.backgroundColor)

    if (!isVisible(styles)) return
    if (!isWrappedText && !isGraphic && !isControl && !isShape) return
    if (width < 3 || height < 3 || area < 12) return
    if (rect.right < cardRect.left || rect.left > cardRect.right || rect.bottom < cardRect.top || rect.top > cardRect.bottom) return
    if (isDuplicatePart(pickedParts, rect)) return

    const partDomId = `${cardDomId}-part-${partIndex + 1}`
    part.setAttribute('data-separate-web-part-id', partDomId)

    pickedParts.push({
      id: `part-${partIndex + 1}`,
      label: (text || part.getAttribute('aria-label') || part.getAttribute('title') || `${tagName} ${partIndex + 1}`).slice(0, 80),
      selector: getSelector(part),
      domId: partDomId,
      bounds: {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width,
        height
      },
      area,
      rect
    })
  })

  return pickedParts
    .sort((a, b) => {
      if (Math.abs(a.bounds.y - b.bounds.y) > 3) return a.bounds.y - b.bounds.y
      if (Math.abs(a.bounds.x - b.bounds.x) > 3) return a.bounds.x - b.bounds.x
      return b.area - a.area
    })
    .slice(0, maxCardParts)
    .map(({ area, rect, ...part }) => part)
}

const isDuplicateBlock = (picked: PickedBlock[], kind: UiBlockKind, rect: DOMRect, area: number) => {
  return picked.some((block) => {
    const sameSize = Math.abs(block.rect.width - rect.width) < 4 && Math.abs(block.rect.height - rect.height) < 4
    const samePlace = Math.abs(block.rect.x - rect.x) < 4 && Math.abs(block.rect.y - rect.y) < 4
    const sameKind = block.kind === kind
    const insidePicked = !DETAIL_KINDS.has(kind) && isContainedBy(rect, block.rect) && area / block.area > 0.92

    return (sameKind && sameSize && samePlace) || insidePicked
  })
}

const hasUsableSize = (kind: UiBlockKind, width: number, height: number, area: number) => {
  if (kind === 'icon') return width >= 6 && height >= 6 && width <= 160 && height <= 160 && area >= 24
  if (['button', 'link', 'field'].includes(kind)) return width >= 10 && height >= 10 && area >= 90
  if (kind === 'modal') return width >= 80 && height >= 56 && area >= 3000
  if (kind === 'card') return width >= 80 && height >= 54 && area >= 2500
  if (!DETAIL_KINDS.has(kind)) return width >= 36 && height >= 28 && area >= 1800
  return true
}

const getHiddenModalCount = () => {
  return Array.from(document.querySelectorAll(MODAL_SELECTOR)).filter((element) => {
    const styles = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()

    return !isVisible(styles) || rect.width === 0 || rect.height === 0
  }).length
}

const createBlock = (element: Element, index: number, maxCardParts: number): PickedBlock | null => {
  const styles = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  const width = Math.round(rect.width)
  const height = Math.round(rect.height)
  const area = width * height
  const kind = getKind(element, styles, rect)
  const domId = `separate-web-${kind}-${index + 1}`
  const viewportWidth = document.documentElement.scrollWidth || window.innerWidth
  const viewportHeight = document.documentElement.scrollHeight || window.innerHeight

  if (!isVisible(styles)) return null
  if (!hasUsableSize(kind, width, height, area)) return null
  if (rect.x > viewportWidth || rect.y > viewportHeight || rect.right < 0 || rect.bottom < 0) return null

  element.setAttribute('data-separate-web-id', domId)

  return {
    id: `${kind}-${index + 1}`,
    label: getLabel(element, index),
    kind,
    tagName: element.tagName,
    selector: getSelector(element),
    parentSelector: element.parentElement ? getSelector(element.parentElement) : '',
    domId,
    bounds: {
      x: rect.x + window.scrollX,
      y: rect.y + window.scrollY,
      width,
      height
    },
    attributes: getAttributes(element),
    state: getState(element, kind),
    area,
    depth: getDepth(element),
    parts: kind === 'card' ? getLayerParts(element, rect, domId, maxCardParts) : [],
    rect
  }
}

export const collectUiCandidates = ({ maxBlocks, maxCardParts }: CollectUiCandidatesOptions) => {
  wrapTextNodes()

  const picked: PickedBlock[] = []
  const hiddenModalCount = getHiddenModalCount()

  Array.from(document.querySelectorAll(ELEMENT_SELECTOR)).forEach((element, index) => {
    const block = createBlock(element, index, maxCardParts)

    if (!block) return
    if (isDuplicateBlock(picked, block.kind, block.rect, block.area)) return

    picked.push(block)
  })

  const blocks = picked
    .sort((a, b) => {
      const kindDelta = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)

      if (kindDelta !== 0) return kindDelta
      if (Math.abs(a.bounds.y - b.bounds.y) > 4) return a.bounds.y - b.bounds.y
      if (Math.abs(a.bounds.x - b.bounds.x) > 4) return a.bounds.x - b.bounds.x
      return b.area - a.area
    })
    .slice(0, maxBlocks)
    .map(({ rect, ...block }) => block)

  return {
    blocks,
    hiddenModalCount
  }
}

export const createCollectUiCandidatesScript = () => {
  const helpers = [
    normalizeText,
    colorHasVisibleAlpha,
    numericStyle,
    wrapTextNodes,
    isCardSurface,
    getKind,
    getLabel,
    getSelector,
    getDepth,
    getAttributes,
    getState,
    isVisible,
    isContainedBy,
    isDuplicatePart,
    getLayerParts,
    isDuplicateBlock,
    hasUsableSize,
    getHiddenModalCount,
    createBlock
  ]
    .map((helper) => `const ${helper.name} = ${helper.toString()}`)
    .join('\n')

  return `
    const ELEMENT_SELECTOR = ${JSON.stringify(ELEMENT_SELECTOR)};
    const MODAL_SELECTOR = ${JSON.stringify(MODAL_SELECTOR)};
    const PART_SELECTOR = ${JSON.stringify(PART_SELECTOR)};
    const KIND_ORDER = ${JSON.stringify(KIND_ORDER)};
    const DETAIL_KINDS = new Set(${JSON.stringify([...DETAIL_KINDS])});
    const ELEMENT_SELECTOR$1 = ELEMENT_SELECTOR;
    const MODAL_SELECTOR$1 = MODAL_SELECTOR;
    const PART_SELECTOR$1 = PART_SELECTOR;
    const KIND_ORDER$1 = KIND_ORDER;
    const DETAIL_KINDS$1 = DETAIL_KINDS;
    ${helpers}
    return (${collectUiCandidates.toString()})(options);
  `
}
