export interface UiExtractionRequest {
  url: string
  crawl?: boolean
  maxPages?: number
}

export interface UiBounds {
  x: number
  y: number
  width: number
  height: number
}

export type UiBlockKind =
  | 'card'
  | 'layout'
  | 'navigation'
  | 'form'
  | 'field'
  | 'button'
  | 'link'
  | 'icon'
  | 'modal'
  | 'content'
  | 'media'

export interface UiBlockAttributes {
  role: string
  type: string
  name: string
  href: string
  ariaLabel: string
  title: string
  classes: string[]
  text: string
}

export interface UiBlockState {
  disabled: boolean
  hasIcon: boolean
  hasText: boolean
  isModalCandidate: boolean
}

export type UiLayerKind =
  | 'original'
  | 'background'
  | 'card-surface'
  | 'card-info'
  | 'card-part'
  | 'icon-transparent'

export interface UiLayerImage {
  kind: UiLayerKind
  label: string
  imageUrl: string
  transparent: boolean
  selector?: string
  text?: string
  bounds?: UiBounds
}

export interface UiBlockImage {
  id: string
  label: string
  kind: UiBlockKind
  tagName: string
  selector: string
  parentSelector: string
  imageUrl: string
  bounds: UiBounds
  attributes: UiBlockAttributes
  state: UiBlockState
  area: number
  depth: number
  layers: UiLayerImage[]
}

export interface UiKindCount {
  kind: UiBlockKind
  count: number
}

export interface UiExtractionResult {
  jobId: string
  url: string
  title: string
  origin: string
  capturedAt: string
  fullPageImageUrl: string
  totalBlocks: number
  hiddenModalCount: number
  categoryCounts: UiKindCount[]
  items: UiBlockImage[]
}

export interface UiCrawlPageResult {
  url: string
  status: 'success' | 'failed'
  result: UiExtractionResult | null
  error: string
}

export interface UiCrawlResult {
  mode: 'crawl'
  startUrl: string
  origin: string
  capturedAt: string
  totalPages: number
  succeededPages: number
  failedPages: number
  pages: UiCrawlPageResult[]
}

export type UiExtractionResponse = UiExtractionResult | UiCrawlResult

export interface UiExtractionState {
  result: UiExtractionResult | null
  crawlResult: UiCrawlResult | null
  error: string
  pending: boolean
}
