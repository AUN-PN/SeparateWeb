#!/usr/bin/env node
import { basename } from 'node:path'
import { parseArgs, parseInstallTarget, usage } from './lib/args.mjs'
import { fail } from './lib/errors.mjs'

const main = async () => {
  const argv = process.argv.slice(2)
  const invokedName = basename(process.argv[1] || '')

  if (invokedName === 'separateweb-capture' && (argv.length === 0 || argv[0] === '--target')) {
    const { installLocalSkill } = await import('./lib/install-skill.mjs')

    await installLocalSkill(parseInstallTarget(argv))
    return
  }

  if (argv[0] === 'install-skill') {
    const { installLocalSkill } = await import('./lib/install-skill.mjs')

    await installLocalSkill(parseInstallTarget(argv.slice(1)))
    return
  }

  const options = parseArgs(argv)

  if (options.help || !options.command) {
    usage()
    return
  }

  if (options.command === 'select') {
    const { listManifestItems } = await import('./lib/manifest-patch.mjs')

    await listManifestItems(options.target)
    return
  }

  if (options.command === 'patch') {
    const { clearPatchPath, setPatchPath, showPatchPath } = await import('./lib/config.mjs')

    if (options.clear) {
      await clearPatchPath()
      return
    }

    if (!options.target) {
      await showPatchPath()
      return
    }

    if (options.items || options.target.endsWith('.json')) {
      fail('Use `create <manifest.json> --items <indexes> --path <dir>` to export selected manifest items.')
    }

    await setPatchPath(options.target)
    return
  }

  if (options.command === 'create') {
    const { createPatch } = await import('./lib/manifest-patch.mjs')
    const result = await createPatch(options)

    console.log(`Patch: ${result.patchManifestPath}`)
    console.log(`Output: ${result.outputDir}`)
    console.log(`Items: ${result.totalItems}`)
    return
  }

  if (options.command !== 'capture') {
    fail(`Unknown command: ${options.command}`)
  }

  const { capture } = await import('./lib/capture-runner.mjs')
  const result = await capture(options)

  console.log(`Captured: ${result.outputDir}`)
  console.log(`Manifest: ${result.manifestPath}`)
  console.log(`Pages: ${result.pages.length}`)
  console.log(`Succeeded: ${result.pages.filter((page) => page.status === 'success').length}`)
  console.log(`Failed: ${result.pages.filter((page) => page.status === 'failed').length}`)
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'Capture failed')
})
