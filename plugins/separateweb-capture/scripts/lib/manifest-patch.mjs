import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { DEFAULT_OUT_DIR } from './constants.mjs'
import { fail } from './errors.mjs'

export const readManifest = async (manifestPath) => {
  if (!manifestPath) fail('manifest.json path is required')

  try {
    return JSON.parse(await readFile(resolve(process.cwd(), manifestPath), 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown manifest read error'
    fail(`Cannot read manifest: ${message}`)
  }
}

const formatItemLine = (item, index) => {
  const bounds = item.bounds
    ? `${item.bounds.width}x${item.bounds.height}+${item.bounds.x}+${item.bounds.y}`
    : 'unknown-bounds'
  const label = item.label || item.selector || item.id || 'untitled'

  return `${index + 1}. [${item.kind}] ${label} (${bounds})`
}

export const listManifestItems = async (manifestPath) => {
  const manifest = await readManifest(manifestPath)
  const items = Array.isArray(manifest.items) ? manifest.items : []

  console.log(`Manifest: ${resolve(process.cwd(), manifestPath)}`)
  console.log(`URL: ${manifest.url || ''}`)
  console.log(`Blocks: ${items.length}`)

  items.forEach((item, index) => {
    console.log(formatItemLine(item, index))
  })
}

const parseItemIndexes = (value, max) => {
  if (!value) fail('--items is required, for example --items 1,3,5')
  if (value === 'all') {
    return Array.from({ length: max }, (_, index) => index)
  }

  const indexes = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((index) => Number.isInteger(index))

  if (!indexes.length) fail('--items must contain indexes, for example 1,3,5')

  const unique = [...new Set(indexes)]

  unique.forEach((index) => {
    if (index < 1 || index > max) {
      fail(`Item index out of range: ${index}`)
    }
  })

  return unique.map((index) => index - 1)
}

const resolveManifestAssetPath = (manifestPath, imagePath) => {
  if (!imagePath) return ''
  if (imagePath.startsWith('/')) return imagePath

  return resolve(dirname(resolve(process.cwd(), manifestPath)), imagePath)
}

export const createPatch = async (options) => {
  const manifestPath = options.target
  const manifest = await readManifest(manifestPath)
  const items = Array.isArray(manifest.items) ? manifest.items : []
  const selectedIndexes = parseItemIndexes(options.items, items.length)
  const outputRoot = options.outDir === DEFAULT_OUT_DIR ? 'patches' : options.outDir
  const patchId = `${manifest.jobId || 'patch'}-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const outputDir = resolve(process.cwd(), outputRoot, patchId)
  const assetDir = join(outputDir, 'items')
  const selectedItems = []

  await mkdir(assetDir, { recursive: true })

  for (const selectedIndex of selectedIndexes) {
    const item = items[selectedIndex]
    const sourceImagePath = resolveManifestAssetPath(manifestPath, item.image?.path)
    const kindDir = join(assetDir, item.kind || 'unknown')
    const imageName = `${String(selectedIndex + 1).padStart(3, '0')}-${item.id || `item-${selectedIndex + 1}`}.png`
    const imagePath = join(kindDir, imageName)

    await mkdir(kindDir, { recursive: true })
    if (sourceImagePath) {
      await copyFile(sourceImagePath, imagePath)
    }

    selectedItems.push({
      index: selectedIndex + 1,
      ...item,
      image: {
        ...item.image,
        path: imagePath
      }
    })
  }

  const patchManifestPath = join(outputDir, 'patch.json')
  const patchManifest = {
    patchId,
    sourceManifest: resolve(process.cwd(), manifestPath),
    sourceUrl: manifest.url || '',
    createdAt: new Date().toISOString(),
    totalItems: selectedItems.length,
    items: selectedItems
  }

  await writeFile(patchManifestPath, `${JSON.stringify(patchManifest, null, 2)}\n`)

  return {
    outputDir,
    patchManifestPath,
    totalItems: selectedItems.length
  }
}
