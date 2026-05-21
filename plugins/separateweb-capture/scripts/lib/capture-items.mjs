import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { sha256 } from './artifact-utils.mjs'
import {
  alphaCleanupThreshold,
  cleanupAlphaHalo,
  captureInnerHiddenPage,
  captureIsolatedItemPage,
  edgeCleanupInsets,
  getCropPadding,
  normalizeCornerRadii,
  readMediaSource,
  roundedMask,
  shouldHideOuterEffects,
  shouldHideInnerContent,
  shouldUseBrowserShape,
  visualCornerRadii
} from './image-crops.mjs'

const isLowSignalImage = async (buffer) => {
  const stats = await sharp(buffer).stats()
  const alpha = stats.channels[3]

  return Boolean(alpha && alpha.max < 32)
}

const applyAlphaTrim = async (buffer, trim) => {
  if (!trim) return buffer

  return sharp(buffer)
    .extract({
      left: trim.x,
      top: trim.y,
      width: trim.width,
      height: trim.height
    })
    .png()
    .toBuffer()
}

const applyOutputCut = async (buffer, trim, outputBuffer) => {
  const trimmed = await applyAlphaTrim(buffer, trim)
  const textRaw = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const outputAlpha = await sharp(outputBuffer)
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true })

  if (
    textRaw.info.width !== outputAlpha.info.width
    || textRaw.info.height !== outputAlpha.info.height
  ) {
    throw new Error('Output alpha mask dimensions do not match text crop')
  }

  for (let index = 0, pixel = 0; index < textRaw.data.length; index += 4, pixel += 1) {
    textRaw.data[index + 3] = outputAlpha.data[pixel]
  }

  return sharp(textRaw.data, {
    raw: {
      width: textRaw.info.width,
      height: textRaw.info.height,
      channels: 4
    }
  })
    .png()
    .toBuffer()
}

export const captureItems = async ({
  page,
  rawItems,
  itemDir,
  textItemDir,
  screenshotBuffer,
  textlessScreenshotBuffer,
  imageWidth,
  imageHeight
}) => {
  const items = []

  for (const [index, item] of rawItems.entries()) {
    const cropPadding = getCropPadding(item, imageWidth, imageHeight)
    const left = Math.max(0, Math.floor(item.bounds.x - cropPadding))
    const top = Math.max(0, Math.floor(item.bounds.y - cropPadding))
    const right = Math.min(imageWidth, Math.ceil(item.bounds.x + item.bounds.width + cropPadding))
    const bottom = Math.min(imageHeight, Math.ceil(item.bounds.y + item.bounds.height + cropPadding))
    const cropWidth = right - left
    const cropHeight = bottom - top

    if (cropWidth < 1 || cropHeight < 1) continue

    const kindDir = join(itemDir, item.kind)
    const textKindDir = join(textItemDir, item.kind)
    const imageName = `${String(index + 1).padStart(3, '0')}-${item.id}-${item.kind}.png`
    const imagePath = join(kindDir, imageName)
    const textImagePath = join(textKindDir, imageName)
    const mediaSource = await readMediaSource(item)
    const isolatedScreenshotBuffer = await captureIsolatedItemPage(page, item, { hideText: true })
    const itemScreenshotBuffer = isolatedScreenshotBuffer || await captureInnerHiddenPage(page, item) || textlessScreenshotBuffer
    const cornerRadii = normalizeCornerRadii(item.cornerRadii, cropWidth, cropHeight)
    const maskRadii = visualCornerRadii(item, cornerRadii, cropWidth, cropHeight)
    const useBrowserShape = Boolean(isolatedScreenshotBuffer) && shouldUseBrowserShape(item)
    const mask = useBrowserShape ? null : roundedMask(cropWidth, cropHeight, maskRadii)

    await mkdir(kindDir, { recursive: true })
    const crop = mediaSource
      ? sharp(mediaSource.buffer)
        .resize(cropWidth, cropHeight, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
      : sharp(itemScreenshotBuffer)
        .extract({
          left,
          top,
          width: cropWidth,
          height: cropHeight
        })

    if (mask) {
      crop
        .ensureAlpha()
        .composite([{
          input: await sharp(mask)
            .resize(cropWidth, cropHeight, { fit: 'fill' })
            .png()
            .toBuffer(),
          blend: 'dest-in'
        }])
    }

    const textCrop = sharp(screenshotBuffer)
      .extract({
        left,
        top,
        width: cropWidth,
        height: cropHeight
      })

    let outputBuffer = await crop
      .png()
      .toBuffer()
    const rawTextOutputBuffer = await textCrop
      .png()
      .toBuffer()
    let textOutputBuffer = rawTextOutputBuffer

    if (await isLowSignalImage(outputBuffer)) continue

    const alphaCleanup = useBrowserShape
      ? await cleanupAlphaHalo(outputBuffer, alphaCleanupThreshold(item))
      : {
          buffer: outputBuffer,
          trim: null,
          alphaThreshold: null
        }
    const textAlphaCleanup = useBrowserShape
      ? {
          buffer: await applyOutputCut(rawTextOutputBuffer, alphaCleanup.trim, alphaCleanup.buffer),
          trim: alphaCleanup.trim,
          alphaThreshold: alphaCleanup.alphaThreshold
        }
      : {
          buffer: await applyOutputCut(rawTextOutputBuffer, null, alphaCleanup.buffer),
          trim: null,
          alphaThreshold: null
        }

    outputBuffer = alphaCleanup.buffer
    textOutputBuffer = textAlphaCleanup.buffer
    const edgeInsets = edgeCleanupInsets(item)
    let edgeTrim = null
    const edgeMetadata = await sharp(outputBuffer).metadata()
    const edgeWidth = edgeMetadata.width || cropWidth
    const edgeHeight = edgeMetadata.height || cropHeight
    const edgeTrimWidth = edgeWidth - edgeInsets.left - edgeInsets.right
    const edgeTrimHeight = edgeHeight - edgeInsets.top - edgeInsets.bottom

    if (edgeTrimWidth > 0 && edgeTrimHeight > 0 && Object.values(edgeInsets).some(Boolean)) {
      outputBuffer = await sharp(outputBuffer)
        .extract({
          left: edgeInsets.left,
          top: edgeInsets.top,
          width: edgeTrimWidth,
          height: edgeTrimHeight
        })
        .png()
        .toBuffer()
      textOutputBuffer = await sharp(textOutputBuffer)
        .extract({
          left: edgeInsets.left,
          top: edgeInsets.top,
          width: edgeTrimWidth,
          height: edgeTrimHeight
        })
        .png()
        .toBuffer()
      edgeTrim = {
        ...edgeInsets,
        width: edgeTrimWidth,
        height: edgeTrimHeight
      }
    }

    const outputMetadata = await sharp(outputBuffer).metadata()
    const textOutputMetadata = await sharp(textOutputBuffer).metadata()

    await sharp(outputBuffer)
      .png()
      .toFile(imagePath)
    await mkdir(textKindDir, { recursive: true })
    await sharp(textOutputBuffer)
      .png()
      .toFile(textImagePath)
    const outputWidth = outputMetadata.width || cropWidth
    const outputHeight = outputMetadata.height || cropHeight
    const textOutputWidth = textOutputMetadata.width || cropWidth
    const textOutputHeight = textOutputMetadata.height || cropHeight
    const outputBounds = alphaCleanup.trim
      ? {
          x: left + alphaCleanup.trim.x + (edgeTrim?.left || 0),
          y: top + alphaCleanup.trim.y + (edgeTrim?.top || 0),
          width: outputWidth,
          height: outputHeight
        }
      : {
          x: left + (edgeTrim?.left || 0),
          y: top + (edgeTrim?.top || 0),
          width: outputWidth,
          height: outputHeight
        }
    const textOutputBounds = textAlphaCleanup.trim
      ? {
          x: left + textAlphaCleanup.trim.x + (edgeTrim?.left || 0),
          y: top + textAlphaCleanup.trim.y + (edgeTrim?.top || 0),
          width: textOutputWidth,
          height: textOutputHeight
        }
      : {
          x: left + (edgeTrim?.left || 0),
          y: top + (edgeTrim?.top || 0),
          width: textOutputWidth,
          height: textOutputHeight
        }

    items.push({
      ...item,
      image: {
        path: imagePath,
        width: outputWidth,
        height: outputHeight,
        sha256: sha256(outputBuffer),
        bounds: outputBounds,
        rawBounds: {
          x: left,
          y: top,
          width: cropWidth,
          height: cropHeight
        },
        cropPadding,
        cornerRadii,
        maskRadii,
        transparentCorners: Boolean(mask),
        browserShape: useBrowserShape,
        alphaCleanup: alphaCleanup.trim
          ? {
              trim: alphaCleanup.trim,
              alphaThreshold: alphaCleanup.alphaThreshold
            }
          : null,
        edgeCleanup: edgeTrim,
        isolated: Boolean(isolatedScreenshotBuffer),
        sourceUrl: mediaSource?.sourceUrl || item.sourceUrl || '',
        sourceAsset: Boolean(mediaSource),
        innerContentHidden: shouldHideInnerContent(item),
        outerEffectsHidden: shouldHideOuterEffects(item),
        textHidden: true
      },
      textImage: {
        path: textImagePath,
        width: textOutputWidth,
        height: textOutputHeight,
        sha256: sha256(textOutputBuffer),
        bounds: textOutputBounds,
        rawBounds: {
          x: left,
          y: top,
          width: cropWidth,
          height: cropHeight
        },
        cropPadding,
        cornerRadii,
        maskRadii,
        transparentCorners: Boolean(mask),
        browserShape: useBrowserShape,
        alphaCleanup: textAlphaCleanup.trim
          ? {
              trim: textAlphaCleanup.trim,
              alphaThreshold: textAlphaCleanup.alphaThreshold
            }
          : null,
        edgeCleanup: edgeTrim,
        sourceUrl: item.sourceUrl || '',
        sourceAsset: false,
        textHidden: false
      }
    })
  }

  return items
}
