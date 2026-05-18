import type { UiExtractionRequest, UiExtractionResponse } from '#shared/types/ui-extraction'

export const uiExtractionService = {
  extract(payload: UiExtractionRequest) {
    return $fetch<UiExtractionResponse>('/api/extract', {
      method: 'POST',
      body: payload
    })
  }
}
