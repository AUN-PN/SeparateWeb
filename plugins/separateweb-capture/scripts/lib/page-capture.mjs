import sharp from 'sharp'

export const primePageForCapture = async (page, viewportHeight) => {
  await page.evaluate(async (height) => {
    const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    await document.fonts?.ready?.catch?.(() => undefined)

    const pageHeight = Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0
    )
    const maxScroll = Math.max(0, pageHeight - window.innerHeight)
    const step = Math.max(200, Math.floor((height || window.innerHeight) * 0.25))
    const positions = [0]

    for (let y = step; y < maxScroll; y += step) {
      positions.push(y)
    }

    if (maxScroll > 0) positions.push(maxScroll)

    for (const y of positions) {
      window.scrollTo(0, y)
      await waitFrame()
      await wait(350)
    }

    window.scrollTo(0, 0)
    await waitFrame()
    await wait(1000)
  }, viewportHeight).catch(() => undefined)
}

export const captureScrolledFullPage = async (page, outputPath, viewportWidth, viewportHeight) => {
  const pageSize = await page.evaluate(() => ({
    width: Math.ceil(Math.max(
      document.body?.scrollWidth || 0,
      document.documentElement?.scrollWidth || 0,
      window.innerWidth
    )),
    height: Math.ceil(Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0,
      window.innerHeight
    ))
  }))
  const imageWidth = Math.max(viewportWidth, pageSize.width)
  const imageHeight = Math.max(viewportHeight, pageSize.height)
  const maxScroll = Math.max(0, imageHeight - viewportHeight)
  const positions = [0]

  for (let y = viewportHeight; y < maxScroll; y += viewportHeight) {
    positions.push(y)
  }

  if (maxScroll > 0 && positions.at(-1) !== maxScroll) positions.push(maxScroll)

  const composites = []

  for (const [index, y] of positions.entries()) {
    await page.evaluate(async ({ scrollY, hideFixed }) => {
      const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      let style = document.getElementById('separateweb-capture-hide-fixed')

      if (!style) {
        style = document.createElement('style')
        style.id = 'separateweb-capture-hide-fixed'
        style.textContent = '[data-separateweb-capture-fixed="true"]{visibility:hidden!important}'
        document.head.append(style)
      }

      document.querySelectorAll('[data-separateweb-capture-fixed]').forEach((element) => {
        element.removeAttribute('data-separateweb-capture-fixed')
      })

      if (hideFixed) {
        document.querySelectorAll('body *').forEach((element) => {
          if (getComputedStyle(element).position === 'fixed') {
            element.setAttribute('data-separateweb-capture-fixed', 'true')
          }
        })
      }

      window.scrollTo(0, scrollY)
      await waitFrame()
      await wait(350)
    }, { scrollY: y, hideFixed: index > 0 })

    composites.push({
      input: await page.screenshot({ fullPage: false }),
      left: 0,
      top: Math.round(y)
    })
  }

  await page.evaluate(() => {
    document.querySelectorAll('[data-separateweb-capture-fixed]').forEach((element) => {
      element.removeAttribute('data-separateweb-capture-fixed')
    })
    document.getElementById('separateweb-capture-hide-fixed')?.remove()
    window.scrollTo(0, 0)
  }).catch(() => undefined)

  const { width, height } = await sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png()
    .toFile(outputPath)

  const buffer = await sharp(outputPath).png().toBuffer()

  return {
    buffer,
    width: width || imageWidth,
    height: height || imageHeight
  }
}
