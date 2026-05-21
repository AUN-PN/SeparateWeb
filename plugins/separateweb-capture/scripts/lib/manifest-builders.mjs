export const buildAgentElements = (items) => {
  return items.map((item) => ({
    id: item.id,
    type: item.semanticType || item.kind,
    kind: item.kind,
    semanticType: item.semanticType || item.kind,
    label: item.label,
    text: item.dom?.text || '',
    tagName: item.dom?.tagName || String(item.tagName || '').toLowerCase(),
    bbox: item.bounds,
    selectors: item.selectors || { css: item.selector },
    actions: item.actions || [],
    aria: item.aria || {},
    dom: item.dom || {},
    crop: {
      path: item.textImage?.path || item.image?.path || '',
      width: item.textImage?.width || item.image?.width || 0,
      height: item.textImage?.height || item.image?.height || 0,
      bounds: item.textImage?.bounds || item.image?.bounds || null,
      sha256: item.textImage?.sha256 || item.image?.sha256 || ''
    },
    textlessCrop: {
      path: item.image?.path || '',
      width: item.image?.width || 0,
      height: item.image?.height || 0,
      bounds: item.image?.bounds || null,
      sha256: item.image?.sha256 || ''
    }
  }))
}

export const buildActionManifest = (elements) => {
  return elements.flatMap((element) => {
    return (element.actions || []).map((action) => ({
      id: `${element.id}:${action}`,
      elementId: element.id,
      action,
      label: element.label,
      semanticType: element.semanticType,
      selector: element.selectors?.captureId || element.selectors?.css || ''
    }))
  })
}

export const collectReplayMetadata = async (browser, page, capturedAt, options, imageWidth, imageHeight) => {
  const environment = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: Array.from(navigator.languages || []),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    devicePixelRatio: window.devicePixelRatio,
    platform: navigator.platform,
    colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })).catch(() => ({}))

  return {
    capturedAt,
    browser: {
      name: 'chromium',
      version: browser.version()
    },
    viewport: {
      width: options.width,
      height: options.height,
      deviceScaleFactor: 1,
      imageWidth,
      imageHeight
    },
    waitStrategy: [
      'goto:domcontentloaded',
      'networkidle<=10000ms',
      'primePageForCapture:lazy-scroll+fonts'
    ],
    environment
  }
}
