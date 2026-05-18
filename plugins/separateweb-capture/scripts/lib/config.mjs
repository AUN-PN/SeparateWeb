import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { CONFIG_DIR, CONFIG_PATH } from './constants.mjs'
import { fail } from './errors.mjs'

export const readConfig = async () => {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  } catch {
    return {}
  }
}

export const writeConfig = async (config) => {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`)
}

export const showPatchPath = async () => {
  const config = await readConfig()

  console.log(`Config: ${CONFIG_PATH}`)
  console.log(`Patch path: ${config.patchPath || '(not set)'}`)
}

export const setPatchPath = async (targetPath) => {
  if (!targetPath) fail('patch path is required')

  const patchPath = resolve(process.cwd(), targetPath)
  const config = {
    ...(await readConfig()),
    patchPath
  }

  await mkdir(patchPath, { recursive: true })
  await writeConfig(config)

  console.log(`Config: ${CONFIG_PATH}`)
  console.log(`Patch path: ${patchPath}`)
}

export const clearPatchPath = async () => {
  const config = await readConfig()

  delete config.patchPath
  await writeConfig(config)

  console.log(`Config: ${CONFIG_PATH}`)
  console.log('Patch path: (not set)')
}
