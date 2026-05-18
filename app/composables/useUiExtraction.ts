import type { UiCrawlResult, UiExtractionResult, UiExtractionState } from '#shared/types/ui-extraction'
import { uiExtractionService } from '~/services/ui-extraction.service'

const isFetchError = (error: unknown): error is { data?: { message?: string }, message?: string } => {
  return typeof error === 'object' && error !== null
}

export const useUiExtraction = () => {
  const state = reactive<UiExtractionState>({
    result: null,
    crawlResult: null,
    error: '',
    pending: false
  })

  const extract = async (url: string, options: { crawl?: boolean, maxPages?: number } = {}): Promise<UiExtractionResult | UiCrawlResult | null> => {
    state.pending = true
    state.error = ''

    try {
      const response = await uiExtractionService.extract({
        url,
        crawl: options.crawl,
        maxPages: options.maxPages
      })

      if ('mode' in response && response.mode === 'crawl') {
        state.crawlResult = response
        state.result = response.pages.find((page) => page.result)?.result || null
      } else {
        state.result = response
        state.crawlResult = null
      }

      return response
    } catch (error) {
      state.result = null
      state.crawlResult = null
      state.error = isFetchError(error)
        ? error.data?.message || error.message || 'Extract failed'
        : 'Extract failed'
      return null
    } finally {
      state.pending = false
    }
  }

  const reset = () => {
    state.result = null
    state.crawlResult = null
    state.error = ''
    state.pending = false
  }

  const selectResult = (result: UiExtractionResult) => {
    state.result = result
  }

  return {
    ...toRefs(state),
    extract,
    selectResult,
    reset
  }
}
