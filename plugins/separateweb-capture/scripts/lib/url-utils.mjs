import { basename } from 'node:path'
import { fail } from './errors.mjs'

export const normalizeUrl = (value) => {
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

export const normalizeDimension = (value, name) => {
  if (!Number.isFinite(value) || value < 320 || value > 10000) {
    fail(`${name} must be a number between 320 and 10000`)
  }

  return Math.floor(value)
}

export const normalizeMaxPages = (value) => {
  if (!Number.isFinite(value) || value < 1 || value > 200) {
    fail('--max-pages must be a number between 1 and 200')
  }

  return Math.floor(value)
}

export const slugFromUrl = (url) => {
  const parsed = new URL(url)
  const pathName = parsed.pathname.replace(/\/+$/, '')
  const raw = basename(pathName) || parsed.hostname

  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'capture'
}

export const normalizePageUrl = (href) => {
  const url = new URL(href)
  url.hash = ''
  url.search = ''

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  return url.toString()
}

export const shouldCrawlByDefault = (url) => {
  const parsed = new URL(url)

  return ['http:', 'https:'].includes(parsed.protocol)
    && (parsed.pathname === '/' || parsed.pathname === '')
    && !parsed.search
}

export const shouldSkipCrawlPath = (url) => {
  return /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|mp4|mp3|webm|css|js|json|xml|txt)(?:$|[?#])/i.test(url.pathname)
}
