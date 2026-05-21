import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import {
  escapeHtml,
  readFileAsset,
  sha256,
  writeJsonAsset,
  writeTextAsset
} from './artifact-utils.mjs'

const animationPositions = async (page, viewportHeight) => {
  return page.evaluate((height) => {
    const pageHeight = Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0,
      window.innerHeight
    )
    const maxScroll = Math.max(0, pageHeight - window.innerHeight)

    return Array.from(new Set([
      0,
      Math.min(maxScroll, Math.round((height || window.innerHeight) * 0.75)),
      Math.min(maxScroll, Math.round(maxScroll * 0.5)),
      maxScroll
    ])).filter((position) => position >= 0)
  }, viewportHeight)
}

const buildAnimationPreviewHtml = ({ title, url, frames, gifRelativePath }) => {
  const frameData = frames.map((frame, index) => ({
    index,
    path: frame.relativePath,
    phaseId: frame.phaseId,
    trigger: frame.trigger,
    scrollY: frame.scrollY,
    elapsedMs: frame.elapsedMs
  }))

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} animation preview</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #050507; color: #f7f4ff; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #050507; }
    main { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; padding: 24px 0 32px; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: end; margin-bottom: 16px; }
    h1 { margin: 0 0 6px; font-size: 20px; line-height: 1.2; letter-spacing: 0; }
    p { margin: 0; color: #aaa4b8; font-size: 13px; }
    a { color: #a78bfa; }
    .stage { border: 1px solid #24202f; border-radius: 8px; overflow: hidden; background: #07070a; box-shadow: 0 24px 80px rgba(0,0,0,.35); }
    img { display: block; width: 100%; height: auto; }
    .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px; border-top: 1px solid #24202f; background: #0b0a10; }
    button { appearance: none; border: 1px solid #3a314e; color: #f7f4ff; background: #171221; border-radius: 6px; min-height: 34px; padding: 0 12px; font: inherit; cursor: pointer; }
    button:hover { background: #211832; }
    input[type="range"] { flex: 1 1 280px; accent-color: #8b5cf6; }
    code { color: #c4b5fd; }
    .meta { min-width: 260px; color: #c9c2d7; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>${escapeHtml(title)} animation preview</h1>
        <p>Frame sequence captured from <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>. GIF fallback: <a href="${escapeHtml(gifRelativePath)}">${escapeHtml(gifRelativePath)}</a></p>
      </div>
      <p><code id="counter"></code></p>
    </header>
    <section class="stage">
      <img id="frame" alt="Captured animation frame" src="${escapeHtml(frameData[0]?.path || '')}">
      <div class="controls">
        <button id="toggle" type="button">Pause</button>
        <input id="scrubber" type="range" min="0" max="${Math.max(0, frameData.length - 1)}" value="0" step="1">
        <div class="meta" id="meta"></div>
      </div>
    </section>
  </main>
  <script>
    const frames = ${JSON.stringify(frameData)};
    let index = 0;
    let playing = true;
    const frame = document.getElementById('frame');
    const scrubber = document.getElementById('scrubber');
    const toggle = document.getElementById('toggle');
    const meta = document.getElementById('meta');
    const counter = document.getElementById('counter');

    const render = () => {
      const current = frames[index] || frames[0];
      if (!current) return;
      frame.src = current.path;
      scrubber.value = index;
      counter.textContent = \`\${index + 1} / \${frames.length}\`;
      meta.textContent = \`\${current.phaseId} · \${current.trigger} · scrollY=\${current.scrollY} · t=\${current.elapsedMs}ms\`;
    };

    toggle.addEventListener('click', () => {
      playing = !playing;
      toggle.textContent = playing ? 'Pause' : 'Play';
    });
    scrubber.addEventListener('input', () => {
      index = Number(scrubber.value);
      playing = false;
      toggle.textContent = 'Play';
      render();
    });
    setInterval(() => {
      if (!playing || !frames.length) return;
      index = (index + 1) % frames.length;
      render();
    }, 180);
    render();
  </script>
</body>
</html>
`
}

export const captureAnimationPreview = async (page, outputDir, options) => {
  const frameDir = join(outputDir, 'animation-frames')
  const previewPath = join(outputDir, 'animation-preview.html')
  const gifPath = join(outputDir, 'animation-preview.gif')
  const width = options.width
  const height = options.height
  const frameIntervalMs = 180
  const frames = []
  const phases = []

  await mkdir(frameDir, { recursive: true })

  const positions = await animationPositions(page, height)
  let frameIndex = 0

  for (const [phaseIndex, scrollY] of positions.entries()) {
    const phaseId = `phase-${String(phaseIndex + 1).padStart(3, '0')}`
    const trigger = phaseIndex === 0 ? 'initial-load' : 'scroll-position'
    const frameCount = phaseIndex === 0 ? 11 : 7
    const phaseFrames = []

    await page.evaluate(async (position) => {
      const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      window.scrollTo(0, position)
      await waitFrame()
    }, scrollY).catch(() => undefined)
    await page.waitForTimeout(120)

    for (let index = 0; index < frameCount; index += 1) {
      frameIndex += 1
      const frameName = `frame-${String(frameIndex).padStart(3, '0')}-${phaseId}.png`
      const framePath = join(frameDir, frameName)
      const buffer = await page.screenshot({ path: framePath, fullPage: false })
      const metadata = await sharp(buffer).metadata()
      const frame = {
        id: `frame-${String(frameIndex).padStart(3, '0')}`,
        phaseId,
        trigger,
        scrollY,
        elapsedMs: index * frameIntervalMs,
        path: framePath,
        relativePath: `animation-frames/${frameName}`,
        width: metadata.width || width,
        height: metadata.height || height,
        sha256: sha256(buffer)
      }

      frames.push(frame)
      phaseFrames.push(frame.id)
      await page.waitForTimeout(frameIntervalMs)
    }

    phases.push({
      id: phaseId,
      trigger,
      scrollY,
      frameIds: phaseFrames
    })
  }

  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => undefined)

  const gifWidth = Math.min(960, width)
  const gifBuffers = []

  for (const frame of frames) {
    gifBuffers.push(await sharp(frame.path)
      .resize({ width: gifWidth })
      .png()
      .toBuffer())
  }

  let gif = null

  if (gifBuffers.length) {
    const gifMetadata = await sharp(gifBuffers[0]).metadata()
    const gifHeight = gifMetadata.height || Math.round(height * (gifWidth / width))

    await sharp({
      create: {
        width: gifWidth,
        height: gifHeight * gifBuffers.length,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        pages: gifBuffers.length,
        pageHeight: gifHeight
      }
    })
      .composite(gifBuffers.map((input, index) => ({
        input,
        left: 0,
        top: index * gifHeight
      })))
      .gif({
        delay: gifBuffers.map(() => frameIntervalMs),
        loop: 0
      })
      .toFile(gifPath)

    gif = {
      ...(await readFileAsset(gifPath)),
      width: gifWidth,
      height: gifHeight,
      frameCount: gifBuffers.length,
      delayMs: frameIntervalMs
    }
  }

  const preview = await writeTextAsset(previewPath, buildAnimationPreviewHtml({
    title: await page.title(),
    url: page.url(),
    frames,
    gifRelativePath: 'animation-preview.gif'
  }))

  return {
    path: preview.path,
    bytes: preview.bytes,
    sha256: preview.sha256,
    format: 'separateweb-animation-preview',
    frameDir,
    frameCount: frames.length,
    frameIntervalMs,
    viewport: { width, height },
    positions,
    phases,
    frames,
    gif
  }
}

export const collectAnimationMetadata = async (page, outputPath, options) => {
  try {
    const metadata = await page.evaluate(async ({ viewportHeight }) => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const normalizeText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
      const parseTimeList = (value) => String(value || '')
        .split(',')
        .map((part) => {
          const trimmed = part.trim()
          if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed) || 0
          if (trimmed.endsWith('s')) return (Number.parseFloat(trimmed) || 0) * 1000
          return Number.parseFloat(trimmed) || 0
        })
      const hasNonZeroTime = (value) => parseTimeList(value).some((time) => time > 0)
      const cssEscape = (value) => {
        if (window.CSS?.escape) return window.CSS.escape(value)
        return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
      }
      const cssPath = (element) => {
        if (!(element instanceof Element)) return ''
        if (element.id) return `${element.tagName.toLowerCase()}#${cssEscape(element.id)}`

        const parts = []
        let current = element

        while (current && current instanceof Element && current !== document.documentElement) {
          const tag = current.tagName.toLowerCase()
          const className = String(current.getAttribute('class') || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(cssEscape)
            .join('.')
          const siblings = Array.from(current.parentElement?.children || []).filter((child) => child.tagName === current.tagName)
          const index = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : ''

          parts.unshift(`${tag}${className ? `.${className}` : ''}${index}`)
          current = current.parentElement

          if (parts.length >= 6) break
        }

        return parts.join(' > ')
      }
      const compactKeyframes = (animation) => {
        const keyframes = animation.effect?.getKeyframes?.() || []

        return keyframes.slice(0, 12).map((keyframe) => {
          const compact = {}

          for (const [key, value] of Object.entries(keyframe)) {
            if (value === undefined || value === null) continue
            if (typeof value === 'object') continue
            compact[key] = String(value).slice(0, 240)
          }

          return compact
        })
      }
      const compactTiming = (animation) => {
        const timing = animation.effect?.getTiming?.() || {}

        return Object.fromEntries(
          Object.entries(timing)
            .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value === null)
            .map(([key, value]) => [key, Number.isFinite(value) ? value : String(value)])
        )
      }
      const computedSnapshot = (element) => {
        const style = getComputedStyle(element)

        return {
          opacity: style.opacity,
          transform: style.transform,
          filter: style.filter,
          clipPath: style.clipPath,
          visibility: style.visibility,
          display: style.display,
          position: style.position,
          top: style.top,
          left: style.left,
          backgroundColor: style.backgroundColor,
          color: style.color,
          willChange: style.willChange,
          animationName: style.animationName,
          animationDuration: style.animationDuration,
          animationDelay: style.animationDelay,
          animationTimingFunction: style.animationTimingFunction,
          animationIterationCount: style.animationIterationCount,
          animationDirection: style.animationDirection,
          animationFillMode: style.animationFillMode,
          animationPlayState: style.animationPlayState,
          transitionProperty: style.transitionProperty,
          transitionDuration: style.transitionDuration,
          transitionDelay: style.transitionDelay,
          transitionTimingFunction: style.transitionTimingFunction
        }
      }
      const bboxSnapshot = (element) => {
        const rect = element.getBoundingClientRect()

        return {
          x: Math.round((rect.x + window.scrollX) * 100) / 100,
          y: Math.round((rect.y + window.scrollY) * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100
        }
      }
      const relevantAttributes = (element) => {
        const names = [
          'class',
          'style',
          'aria-expanded',
          'aria-hidden',
          'aria-selected',
          'data-state',
          'data-status',
          'data-open',
          'data-active',
          'data-motion',
          'data-animate',
          'data-framer-motion'
        ]
        const attributes = {}

        for (const name of names) {
          const value = element.getAttribute(name)
          if (value !== null) attributes[name] = value.slice(0, 240)
        }

        return attributes
      }
      const activeAnimationsFor = (element) => {
        return element.getAnimations({ subtree: false }).map((animation) => ({
          id: animation.id || '',
          playState: animation.playState,
          currentTime: animation.currentTime,
          playbackRate: animation.playbackRate,
          type: animation.constructor?.name || 'Animation',
          timing: compactTiming(animation),
          keyframes: compactKeyframes(animation)
        }))
      }
      const hasAnimationSignal = (element, activeTargets) => {
        const style = getComputedStyle(element)
        const active = activeTargets.has(element)
        const hasCssAnimation = style.animationName !== 'none' && hasNonZeroTime(style.animationDuration)
        const hasTransition = style.transitionProperty !== 'none' && hasNonZeroTime(style.transitionDuration)
        const hasMotionStyle = style.transform !== 'none'
          || style.opacity !== '1'
          || style.filter !== 'none'
          || style.clipPath !== 'none'
          || /transform|opacity|filter|clip-path|translate|scale|rotate/.test(style.willChange || '')

        return active || hasCssAnimation || hasTransition || hasMotionStyle
      }
      const scoreElement = (element, activeTargets) => {
        const style = getComputedStyle(element)
        let score = 0

        if (activeTargets.has(element)) score += 100
        if (style.animationName !== 'none') score += 60
        if (style.transitionProperty !== 'none' && hasNonZeroTime(style.transitionDuration)) score += 35
        if (style.transform !== 'none') score += 25
        if (style.opacity !== '1') score += 20
        if (/transform|opacity|filter/.test(style.willChange || '')) score += 12

        return score
      }
      const collectElements = () => {
        const activeTargets = new Set(
          document.getAnimations({ subtree: true })
            .map((animation) => animation.effect?.target)
            .filter((target) => target instanceof Element)
        )

        return Array.from(document.querySelectorAll('*'))
          .filter((element) => hasAnimationSignal(element, activeTargets))
          .map((element) => {
            const computed = computedSnapshot(element)

            return {
              selector: cssPath(element),
              tagName: element.tagName.toLowerCase(),
              id: element.id || '',
              label: normalizeText(
                element.getAttribute('aria-label')
                || element.getAttribute('title')
                || element.textContent
                || ''
              ).slice(0, 140),
              text: normalizeText(element.textContent || '').slice(0, 240),
              attributes: relevantAttributes(element),
              bbox: bboxSnapshot(element),
              computed,
              cssAnimation: {
                name: computed.animationName,
                duration: computed.animationDuration,
                delay: computed.animationDelay,
                timingFunction: computed.animationTimingFunction,
                iterationCount: computed.animationIterationCount,
                direction: computed.animationDirection,
                fillMode: computed.animationFillMode,
                playState: computed.animationPlayState
              },
              cssTransition: {
                property: computed.transitionProperty,
                duration: computed.transitionDuration,
                delay: computed.transitionDelay,
                timingFunction: computed.transitionTimingFunction
              },
              activeAnimations: activeAnimationsFor(element),
              score: scoreElement(element, activeTargets)
            }
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 120)
      }
      const diffEntries = (before, after) => {
        if (!before || !after) return []
        const changes = []
        const styleKeys = [
          'opacity',
          'transform',
          'filter',
          'clipPath',
          'visibility',
          'display',
          'backgroundColor',
          'color',
          'animationPlayState'
        ]

        for (const key of styleKeys) {
          if (before.computed?.[key] !== after.computed?.[key]) {
            changes.push({
              field: `computed.${key}`,
              before: before.computed?.[key],
              after: after.computed?.[key]
            })
          }
        }

        for (const key of ['x', 'y', 'width', 'height']) {
          if (Math.abs((before.bbox?.[key] || 0) - (after.bbox?.[key] || 0)) >= 0.5) {
            changes.push({
              field: `bbox.${key}`,
              before: before.bbox?.[key],
              after: after.bbox?.[key]
            })
          }
        }

        if (before.attributes?.class !== after.attributes?.class) {
          changes.push({
            field: 'attributes.class',
            before: before.attributes?.class || '',
            after: after.attributes?.class || ''
          })
        }

        return changes
      }

      const eventTypes = [
        'animationstart',
        'animationiteration',
        'animationend',
        'animationcancel',
        'transitionrun',
        'transitionstart',
        'transitionend',
        'transitioncancel'
      ]
      const events = []
      const startedAt = performance.now()
      const eventHandler = (event) => {
        if (events.length >= 400) return
        events.push({
          type: event.type,
          elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
          selector: cssPath(event.target),
          tagName: event.target?.tagName?.toLowerCase?.() || '',
          name: event.animationName || event.propertyName || '',
          elapsedTime: event.elapsedTime,
          pseudoElement: event.pseudoElement || ''
        })
      }

      eventTypes.forEach((type) => document.addEventListener(type, eventHandler, true))

      const pageHeight = Math.max(
        document.body?.scrollHeight || 0,
        document.documentElement?.scrollHeight || 0,
        window.innerHeight
      )
      const maxScroll = Math.max(0, pageHeight - window.innerHeight)
      const positions = Array.from(new Set([
        0,
        Math.min(maxScroll, Math.round((viewportHeight || window.innerHeight) * 0.75)),
        Math.min(maxScroll, Math.round(maxScroll * 0.5)),
        maxScroll
      ])).filter((position) => position >= 0)
      const phases = []

      for (const [index, position] of positions.entries()) {
        window.scrollTo(0, position)
        await waitFrame()
        const before = collectElements()
        await wait(index === 0 ? 1800 : 900)
        await waitFrame()
        const after = collectElements()
        const afterBySelector = new Map(after.map((entry) => [entry.selector, entry]))
        const phaseElements = before.map((entry) => {
          const afterEntry = afterBySelector.get(entry.selector)
          const changes = diffEntries(entry, afterEntry)

          return {
            selector: entry.selector,
            tagName: entry.tagName,
            id: entry.id,
            label: entry.label,
            score: entry.score,
            before: entry,
            after: afterEntry || null,
            changes
          }
        })

        phases.push({
          id: `phase-${String(index + 1).padStart(3, '0')}`,
          trigger: index === 0 ? 'initial-load' : 'scroll-position',
          scrollY: position,
          beforeElementCount: before.length,
          afterElementCount: after.length,
          changedElementCount: phaseElements.filter((entry) => entry.changes.length).length,
          elements: phaseElements.slice(0, 80)
        })
      }

      eventTypes.forEach((type) => document.removeEventListener(type, eventHandler, true))
      window.scrollTo(0, 0)
      await waitFrame()

      const uniqueSelectors = new Set()
      const changedSelectors = new Set()
      let activeAnimationCount = 0
      let transitionElementCount = 0

      for (const phase of phases) {
        for (const entry of phase.elements) {
          uniqueSelectors.add(entry.selector)
          if (entry.changes.length) changedSelectors.add(entry.selector)
          activeAnimationCount += entry.before.activeAnimations?.length || 0
          if (entry.before.cssTransition?.property && entry.before.cssTransition.property !== 'none') {
            transitionElementCount += 1
          }
        }
      }

      return {
        capturedAt: new Date().toISOString(),
        url: location.href,
        title: document.title,
        format: 'separateweb-animation-metadata',
        observation: {
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          positions,
          eventTypes
        },
        summary: {
          animatedElementCount: uniqueSelectors.size,
          changedElementCount: changedSelectors.size,
          activeAnimationCount,
          transitionElementCount,
          eventCount: events.length
        },
        events,
        phases
      }
    }, { viewportHeight: options.height })

    return {
      ...(await writeJsonAsset(outputPath, metadata)),
      format: metadata.format,
      summary: metadata.summary
    }
  } catch (error) {
    return {
      path: outputPath,
      error: error instanceof Error ? error.message : 'Animation metadata capture failed'
    }
  }
}
