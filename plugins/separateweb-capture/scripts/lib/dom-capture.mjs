import { writeFile } from 'node:fs/promises'
import { sha256, writeJsonAsset } from './artifact-utils.mjs'

export const collectDomSummary = async (page) => {
  return page.evaluate(() => {
    const normalizeText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
    const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
      .slice(0, 30)
      .map((heading) => ({
        level: heading.tagName.toLowerCase(),
        text: normalizeText(heading.textContent || '').slice(0, 180)
      }))
      .filter((heading) => heading.text)
    const landmarks = Array.from(document.querySelectorAll('header,nav,main,aside,footer,form,[role]'))
      .slice(0, 80)
      .map((element) => ({
        tagName: element.tagName.toLowerCase(),
        role: element.getAttribute('role') || '',
        label: normalizeText(element.getAttribute('aria-label') || element.textContent || '').slice(0, 120)
      }))
      .filter((landmark) => landmark.role || landmark.label)

    return {
      url: location.href,
      title: document.title,
      lang: document.documentElement.lang || '',
      characterSet: document.characterSet || '',
      readyState: document.readyState,
      counts: {
        elements: document.querySelectorAll('*').length,
        links: document.querySelectorAll('a[href]').length,
        images: document.querySelectorAll('img,picture,svg,canvas,video').length,
        forms: document.forms.length,
        inputs: document.querySelectorAll('input,textarea,select,button').length,
        scripts: document.scripts.length,
        stylesheets: document.styleSheets.length
      },
      headings,
      landmarks
    }
  }).catch((error) => ({
    error: error instanceof Error ? error.message : 'DOM summary failed'
  }))
}

export const collectDomSnapshot = async (page, outputPath, rawOutputPath) => {
  const { replayHtml, rawHtml } = await page.evaluate((baseHref) => {
    const doctype = document.doctype ? `<!DOCTYPE ${document.doctype.name}>` : '<!DOCTYPE html>'
    const rawHtml = `${doctype}\n${document.documentElement.outerHTML}`
    const replayDocument = document.documentElement.cloneNode(true)
    let head = replayDocument.querySelector('head')

    if (!head) {
      head = document.createElement('head')

      if (replayDocument.firstChild) {
        replayDocument.insertBefore(head, replayDocument.firstChild)
      } else {
        replayDocument.append(head)
      }
    }

    head.querySelectorAll('base[data-separateweb-replay-base]').forEach((base) => base.remove())

    const base = document.createElement('base')
    base.setAttribute('data-separateweb-replay-base', 'true')
    base.href = baseHref
    head.insertBefore(base, head.firstChild)

    replayDocument.querySelectorAll('script').forEach((script) => {
      const source = script.getAttribute('src')
      const type = script.getAttribute('type')

      if (source) {
        script.setAttribute('data-separateweb-script-src', source)
        script.removeAttribute('src')
      }

      if (type) script.setAttribute('data-separateweb-script-type', type)
      script.setAttribute('type', 'application/separateweb-disabled-script')
    })

    return {
      rawHtml,
      replayHtml: `${doctype}\n${replayDocument.outerHTML}`
    }
  }, page.url())
  const buffer = Buffer.from(replayHtml)
  const rawBuffer = Buffer.from(rawHtml)

  await writeFile(outputPath, buffer)
  await writeFile(rawOutputPath, rawBuffer)

  return {
    path: outputPath,
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
    format: 'html',
    replayBaseHref: page.url(),
    raw: {
      path: rawOutputPath,
      bytes: rawBuffer.byteLength,
      sha256: sha256(rawBuffer),
      format: 'html'
    }
  }
}

const axValue = (entry) => {
  if (!entry || typeof entry !== 'object') return entry ?? null
  return Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : null
}

export const collectAccessibilityTree = async (page, outputPath) => {
  let session

  try {
    session = await page.context().newCDPSession(page)
    const result = await session.send('Accessibility.getFullAXTree')
    const nodes = Array.isArray(result.nodes) ? result.nodes : []
    const compactNodes = nodes.map((node) => {
      const properties = Object.fromEntries(
        (node.properties || [])
          .map((property) => [property.name, axValue(property.value)])
          .filter(([, value]) => value !== null && value !== '')
      )

      return {
        nodeId: node.nodeId,
        backendDOMNodeId: node.backendDOMNodeId,
        ignored: Boolean(node.ignored),
        role: axValue(node.role) || '',
        name: axValue(node.name) || '',
        value: axValue(node.value),
        description: axValue(node.description) || '',
        childIds: node.childIds || [],
        properties
      }
    })
    const asset = {
      capturedAt: new Date().toISOString(),
      url: page.url(),
      format: 'chromium-accessibility-tree',
      nodeCount: compactNodes.length,
      nodes: compactNodes
    }

    return {
      ...(await writeJsonAsset(outputPath, asset)),
      format: asset.format,
      nodeCount: compactNodes.length
    }
  } catch (error) {
    return {
      path: outputPath,
      error: error instanceof Error ? error.message : 'Accessibility tree capture failed'
    }
  } finally {
    await session?.detach().catch(() => undefined)
  }
}
