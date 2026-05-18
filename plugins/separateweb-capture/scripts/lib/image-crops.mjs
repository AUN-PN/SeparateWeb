import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

export const captureTextlessPage = async (page, outputPath) => {
  await page.addStyleTag({
    content: `
      body, body * {
        color: transparent !important;
        text-shadow: none !important;
        -webkit-text-fill-color: transparent !important;
        caret-color: transparent !important;
      }

      body *::before,
      body *::after,
      input::placeholder,
      textarea::placeholder,
      svg text {
        color: transparent !important;
        fill: transparent !important;
        stroke: transparent !important;
        text-shadow: none !important;
        -webkit-text-fill-color: transparent !important;
      }
    `
  })

  return page.screenshot({
    fullPage: true,
    path: outputPath
  })
}

export const shouldHideInnerContent = (item) => {
  return ['card-large', 'card', 'panel', 'badge'].includes(item.kind)
}

const shouldIsolateItem = (item) => {
  return ['card-large', 'card', 'panel', 'button', 'badge', 'stat', 'price', 'media', 'icon'].includes(item.kind)
}

export const shouldHideOuterEffects = (item) => {
  return ['button', 'badge'].includes(item.kind)
}

export const shouldUseBrowserShape = (item) => {
  return ['button', 'badge', 'stat', 'price', 'media', 'icon'].includes(item.kind)
}

export const getCropPadding = (item, imageWidth, imageHeight) => {
  const imageArea = imageWidth * imageHeight

  if (item.kind === 'card-large' && item.area >= imageArea * 0.45) return 0
  if (shouldHideInnerContent(item)) return 0
  if (shouldHideOuterEffects(item)) return 0
  if (['stat', 'price', 'media', 'icon'].includes(item.kind)) return 0
  return 0
}

export const alphaCleanupThreshold = (item) => {
  if (['button', 'badge'].includes(item.kind)) return 56
  return 18
}

export const edgeCleanupInsets = (item) => {
  if (['button', 'badge'].includes(item.kind)) return {
    top: 1,
    right: 0,
    bottom: 0,
    left: 0
  }

  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  }
}

export const normalizeCornerRadii = (radii, width, height) => {
  const fallback = Number.isFinite(radii) ? {
    topLeft: { x: radii, y: radii },
    topRight: { x: radii, y: radii },
    bottomRight: { x: radii, y: radii },
    bottomLeft: { x: radii, y: radii }
  } : radii || {}
  const normalize = (corner) => {
    return {
      x: Math.max(0, Math.min(Math.round(corner?.x || 0), Math.floor(width / 2))),
      y: Math.max(0, Math.min(Math.round(corner?.y || 0), Math.floor(height / 2)))
    }
  }

  return {
    topLeft: normalize(fallback.topLeft),
    topRight: normalize(fallback.topRight),
    bottomRight: normalize(fallback.bottomRight),
    bottomLeft: normalize(fallback.bottomLeft)
  }
}

export const visualCornerRadii = (item, radii, width, height) => {
  const normalized = normalizeCornerRadii(radii, width, height)

  return normalized
}

export const roundedMask = (width, height, radii) => {
  const normalized = normalizeCornerRadii(radii, width, height)
  const hasRadius = Object.values(normalized).some((corner) => corner.x > 0 || corner.y > 0)

  if (!hasRadius) return null

  const scale = 4
  const scaledWidth = width * scale
  const scaledHeight = height * scale
  const r = Object.fromEntries(
    Object.entries(normalized).map(([key, corner]) => [
      key,
      {
        x: corner.x * scale,
        y: corner.y * scale
      }
    ])
  )
  const path = [
    `M ${r.topLeft.x} 0`,
    `L ${scaledWidth - r.topRight.x} 0`,
    `A ${r.topRight.x} ${r.topRight.y} 0 0 1 ${scaledWidth} ${r.topRight.y}`,
    `L ${scaledWidth} ${scaledHeight - r.bottomRight.y}`,
    `A ${r.bottomRight.x} ${r.bottomRight.y} 0 0 1 ${scaledWidth - r.bottomRight.x} ${scaledHeight}`,
    `L ${r.bottomLeft.x} ${scaledHeight}`,
    `A ${r.bottomLeft.x} ${r.bottomLeft.y} 0 0 1 0 ${scaledHeight - r.bottomLeft.y}`,
    `L 0 ${r.topLeft.y}`,
    `A ${r.topLeft.x} ${r.topLeft.y} 0 0 1 ${r.topLeft.x} 0`,
    'Z'
  ].join(' ')

  return Buffer.from(`
    <svg width="${scaledWidth}" height="${scaledHeight}" viewBox="0 0 ${scaledWidth} ${scaledHeight}" xmlns="http://www.w3.org/2000/svg">
      <path d="${path}" fill="#fff"/>
    </svg>
  `)
}

export const cleanupAlphaHalo = async (buffer, alphaThreshold = 18) => {
  const image = sharp(buffer).ensureAlpha()
  const metadata = await image.metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  if (!width || !height) return {
    buffer,
    trim: null,
    alphaThreshold
  }

  const raw = await image.raw().toBuffer()
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let index = 0; index < raw.length; index += 4) {
    if (raw[index + 3] < alphaThreshold) {
      raw[index + 3] = 0
      continue
    }

    const pixel = index / 4
    const x = pixel % width
    const y = Math.floor(pixel / width)

    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  if (maxX < minX || maxY < minY) return {
    buffer,
    trim: null,
    alphaThreshold
  }

  const trim = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  }
  const cleaned = await sharp(raw, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .extract({
      left: trim.x,
      top: trim.y,
      width: trim.width,
      height: trim.height
    })
    .png()
    .toBuffer()

  return {
    buffer: cleaned,
    trim,
    alphaThreshold
  }
}

export const captureInnerHiddenPage = async (page, item) => {
  if (!item.captureId || !shouldHideInnerContent(item)) return null

  const styleHandle = await page.addStyleTag({
    content: `
      [data-separateweb-capture-id="${item.captureId}"] > * {
        visibility: hidden !important;
        opacity: 0 !important;
      }

      [data-separateweb-capture-id="${item.captureId}"] > *::before,
      [data-separateweb-capture-id="${item.captureId}"] > *::after {
        visibility: hidden !important;
        opacity: 0 !important;
      }
    `
  })

  try {
    return await page.screenshot({ fullPage: true })
  } finally {
    await styleHandle.evaluate((node) => node.remove()).catch(() => undefined)
  }
}

export const captureIsolatedItemPage = async (page, item) => {
  if (!item.captureId || !shouldIsolateItem(item)) return null

  await page.evaluate(({ captureId, hideChildren, hideOuterEffects }) => {
    document.querySelectorAll('[data-separateweb-isolate]').forEach((element) => {
      element.removeAttribute('data-separateweb-isolate')
    })
    document.querySelectorAll('[data-separateweb-hide-effects]').forEach((element) => {
      element.removeAttribute('data-separateweb-hide-effects')
    })
    document.querySelectorAll('[data-separateweb-hide-children]').forEach((element) => {
      element.removeAttribute('data-separateweb-hide-children')
    })
    document.querySelectorAll('[data-separateweb-isolate-descendant]').forEach((element) => {
      element.removeAttribute('data-separateweb-isolate-descendant')
    })
    document.querySelectorAll('[data-separateweb-isolate-ancestor]').forEach((element) => {
      element.removeAttribute('data-separateweb-isolate-ancestor')
    })

    const target = document.querySelector(`[data-separateweb-capture-id="${captureId}"]`)

    if (!target) return

    target.setAttribute('data-separateweb-isolate', 'target')
    if (hideOuterEffects) target.setAttribute('data-separateweb-hide-effects', 'true')
    if (hideChildren) target.setAttribute('data-separateweb-hide-children', 'true')
    if (!hideChildren) {
      target.querySelectorAll('*').forEach((child) => {
        child.setAttribute('data-separateweb-isolate-descendant', 'true')
      })
    }

    let parent = target.parentElement
    while (parent) {
      parent.setAttribute('data-separateweb-isolate-ancestor', 'true')
      parent = parent.parentElement
    }
  }, {
    captureId: item.captureId,
    hideChildren: shouldHideInnerContent(item),
    hideOuterEffects: shouldHideOuterEffects(item)
  })

  const styleHandle = await page.addStyleTag({
    content: `
      html,
      body {
        background: transparent !important;
      }

      body::before,
      body::after {
        opacity: 0 !important;
        visibility: hidden !important;
      }

      body *:not([data-separateweb-isolate]):not([data-separateweb-isolate-descendant]):not([data-separateweb-isolate-ancestor]) {
        visibility: hidden !important;
        opacity: 0 !important;
      }

      [data-separateweb-isolate-ancestor] {
        background: transparent !important;
        background-image: none !important;
        border-color: transparent !important;
        box-shadow: none !important;
      }

      [data-separateweb-isolate-ancestor]::before,
      [data-separateweb-isolate-ancestor]::after {
        opacity: 0 !important;
        visibility: hidden !important;
      }

      [data-separateweb-isolate] {
        visibility: visible !important;
        opacity: 1 !important;
      }

      [data-separateweb-isolate-descendant] {
        visibility: visible !important;
        opacity: 1 !important;
      }

      [data-separateweb-hide-effects] {
        box-shadow: none !important;
        filter: none !important;
      }

      [data-separateweb-hide-children] > *,
      [data-separateweb-hide-children]::before,
      [data-separateweb-hide-children]::after {
        visibility: hidden !important;
        opacity: 0 !important;
      }
    `
  })

  try {
    return await page.screenshot({ fullPage: true, omitBackground: true })
  } finally {
    await styleHandle.evaluate((node) => node.remove()).catch(() => undefined)
    await page.evaluate(() => {
      document.querySelectorAll('[data-separateweb-isolate]').forEach((element) => {
        element.removeAttribute('data-separateweb-isolate')
      })
      document.querySelectorAll('[data-separateweb-hide-effects]').forEach((element) => {
        element.removeAttribute('data-separateweb-hide-effects')
      })
      document.querySelectorAll('[data-separateweb-hide-children]').forEach((element) => {
        element.removeAttribute('data-separateweb-hide-children')
      })
      document.querySelectorAll('[data-separateweb-isolate-descendant]').forEach((element) => {
        element.removeAttribute('data-separateweb-isolate-descendant')
      })
      document.querySelectorAll('[data-separateweb-isolate-ancestor]').forEach((element) => {
        element.removeAttribute('data-separateweb-isolate-ancestor')
      })
    }).catch(() => undefined)
  }
}

export const readMediaSource = async (item) => {
  if (item.kind !== 'media' || !item.sourceUrl) return null

  try {
    const sourceUrl = new URL(item.sourceUrl)

    if (sourceUrl.protocol === 'file:') {
      return {
        buffer: await readFile(fileURLToPath(sourceUrl)),
        sourceUrl: item.sourceUrl
      }
    }

    if (sourceUrl.protocol === 'http:' || sourceUrl.protocol === 'https:') {
      const response = await fetch(sourceUrl)

      if (!response.ok) return null

      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        sourceUrl: item.sourceUrl
      }
    }
  } catch {
    return null
  }

  return null
}
