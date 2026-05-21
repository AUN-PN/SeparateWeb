import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

export const sha256 = (value) => createHash('sha256').update(value).digest('hex')

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

export const writeJsonAsset = async (outputPath, value) => {
  const buffer = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  await writeFile(outputPath, buffer)

  return {
    path: outputPath,
    bytes: buffer.byteLength,
    sha256: sha256(buffer)
  }
}

export const writeTextAsset = async (outputPath, value) => {
  const buffer = Buffer.from(value)
  await writeFile(outputPath, buffer)

  return {
    path: outputPath,
    bytes: buffer.byteLength,
    sha256: sha256(buffer)
  }
}

export const readFileAsset = async (outputPath) => {
  const buffer = await readFile(outputPath)

  return {
    path: outputPath,
    bytes: buffer.byteLength,
    sha256: sha256(buffer)
  }
}
