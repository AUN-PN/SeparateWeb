import { lookup } from 'node:dns/promises'
import { stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { UiExtractionRequest } from '#shared/types/ui-extraction'
import type * as UiExtractionService from '../services/ui-extraction.service'

type CaptureOptions = {
  allowPrivateCapture: boolean
  allowFileCapture: boolean
}

type ExtractRuntimeConfig = CaptureOptions & {
  extractServiceUrl: string
  extractServiceToken: string
}

const isCloudflareRuntime = () => {
  return process.env.NITRO_PRESET === 'cloudflare-module'
    || process.env.NITRO_PRESET === 'cloudflare-pages'
}

const normalizeExtractServiceEndpoint = (serviceUrl: string) => {
  const endpoint = new URL(serviceUrl)

  if (endpoint.pathname === '/') {
    endpoint.pathname = '/api/extract'
  }

  return endpoint.toString()
}

const getExtractRuntimeConfig = (event: Parameters<typeof useRuntimeConfig>[0]): ExtractRuntimeConfig => {
  const config = useRuntimeConfig(event)

  return {
    allowPrivateCapture: config.allowPrivateCapture,
    allowFileCapture: config.allowFileCapture,
    extractServiceUrl: config.extractServiceUrl,
    extractServiceToken: config.extractServiceToken
  }
}

const assertExtractServiceAuthorized = (event: Parameters<typeof getHeader>[0], token: string) => {
  if (!token) {
    return
  }

  if (getHeader(event, 'authorization') !== `Bearer ${token}`) {
    throw createError({
      statusCode: 401,
      message: 'Invalid extraction service token'
    })
  }
}

const proxyExtractRequest = async (
  serviceUrl: string,
  token: string,
  body: UiExtractionRequest
) => {
  const endpoint = normalizeExtractServiceEndpoint(serviceUrl)

  try {
    return await $fetch(endpoint, {
      method: 'POST',
      body,
      headers: token
        ? { authorization: `Bearer ${token}` }
        : undefined
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 502,
      message: 'Extraction service is unreachable.'
    })
  }
}

const loadUiExtractionService = async (): Promise<typeof UiExtractionService> => {
  const servicePath = '../services/ui-extraction.service'
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<typeof UiExtractionService>

  return dynamicImport(servicePath)
}

const isPrivateIPv4 = (address: string) => {
  const parts = address.split('.').map(Number)

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false
  }

  const [first, second] = parts

  return first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
}

const isPrivateIPv6 = (address: string) => {
  const normalized = address.toLowerCase()

  return normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80')
}

const assertAllowedTarget = async (target: URL, options: CaptureOptions) => {
  if (target.protocol === 'file:') {
    if (!options.allowFileCapture) {
      throw createError({
        statusCode: 400,
        message: 'File capture is disabled. Set ALLOW_FILE_CAPTURE=true for file URLs.'
      })
    }

    let filePath: string

    try {
      filePath = fileURLToPath(target)
    } catch {
      throw createError({
        statusCode: 400,
        message: 'Invalid file URL'
      })
    }

    const fileStat = await stat(filePath).catch(() => null)

    if (!fileStat?.isFile()) {
      throw createError({
        statusCode: 400,
        message: 'File URL must point to an existing file'
      })
    }

    return
  }

  if (options.allowPrivateCapture) {
    return
  }

  if (target.hostname === 'localhost' || target.hostname.endsWith('.local')) {
    throw createError({
      statusCode: 400,
      message: 'Private capture is disabled. Set ALLOW_PRIVATE_CAPTURE=true for local URLs.'
    })
  }

  const records = await lookup(target.hostname, { all: true })
  const blocked = records.some((record) => {
    return record.family === 4
      ? isPrivateIPv4(record.address)
      : isPrivateIPv6(record.address)
  })

  if (blocked) {
    throw createError({
      statusCode: 400,
      message: 'Private capture is disabled. Set ALLOW_PRIVATE_CAPTURE=true for private IP targets.'
    })
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<UiExtractionRequest>(event)
  const config = getExtractRuntimeConfig(event)

  if (config.extractServiceUrl) {
    return proxyExtractRequest(config.extractServiceUrl, config.extractServiceToken, body)
  }

  if (isCloudflareRuntime()) {
    throw createError({
      statusCode: 501,
      message: 'UI extraction requires EXTRACT_SERVICE_URL on the Cloudflare runtime.'
    })
  }

  assertExtractServiceAuthorized(event, config.extractServiceToken)

  const rawUrl = body.url?.trim()

  if (!rawUrl) {
    throw createError({
      statusCode: 400,
      message: 'URL is required'
    })
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw createError({
      statusCode: 400,
      message: 'Invalid URL'
    })
  }

  if (!['http:', 'https:', 'file:'].includes(parsedUrl.protocol)) {
    throw createError({
      statusCode: 400,
      message: 'Only http, https, and file URLs are supported'
    })
  }

  await assertAllowedTarget(parsedUrl, {
    allowPrivateCapture: config.allowPrivateCapture,
    allowFileCapture: config.allowFileCapture
  })

  if (body.crawl) {
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw createError({
        statusCode: 400,
        message: 'Crawl is only supported for http and https URLs'
      })
    }

    const { crawlAndExtractUiFromUrl } = await loadUiExtractionService().catch(() => {
      throw createError({
        statusCode: 501,
        message: 'UI extraction requires EXTRACT_SERVICE_URL on this runtime.'
      })
    })

    return crawlAndExtractUiFromUrl(parsedUrl.toString(), body.maxPages)
  }

  const { extractUiFromUrl } = await loadUiExtractionService().catch(() => {
    throw createError({
      statusCode: 501,
      message: 'UI extraction requires EXTRACT_SERVICE_URL on this runtime.'
    })
  })

  return extractUiFromUrl(parsedUrl.toString())
})
