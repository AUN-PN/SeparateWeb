import { DEFAULT_MAX_PAGES, DEFAULT_OUT_DIR, DEFAULT_VIEWPORT } from './constants.mjs'
import { fail } from './errors.mjs'

export const usage = () => {
  console.log(`Usage:
  separateweb capture <url> [--out <dir>] [--width <px>] [--height <px>] [--max-pages <n>] [--single|--all]
  separateweb patch <dir>
  separateweb patch --clear
  separateweb select <manifest.json>
  separateweb create <manifest.json> --items <indexes> --path <dir>
  separateweb install-skill [--target codex|claude|both]
  separateweb-capture [--target codex|claude|both]
  node scripts/capture.mjs capture <url>

Example:
  npx separateweb-capture
  npx separateweb-capture --target both
  separateweb patch /absolute/output/path
  separateweb capture https://demo.separateweb.dev/
  separateweb capture https://demo.separateweb.dev/orbit-store --single
  separateweb select captures/<jobId>/manifest.json
  separateweb create captures/<jobId>/manifest.json --items 1,3,5 --path /absolute/output/path`)
}

export const parseArgs = (argv) => {
  const [command, rawTarget, ...rest] = argv
  const options = {
    command,
    target: rawTarget,
    url: rawTarget,
    outDir: DEFAULT_OUT_DIR,
    outDirSet: false,
    items: '',
    width: DEFAULT_VIEWPORT.width,
    height: DEFAULT_VIEWPORT.height,
    maxPages: DEFAULT_MAX_PAGES,
    all: argv.includes('--all'),
    single: argv.includes('--single'),
    clear: argv.includes('--clear'),
    help: argv.includes('--help') || argv.includes('-h')
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    const next = rest[index + 1]

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    if (arg === '--out') {
      if (!next) fail('--out requires a directory')
      options.outDir = next
      options.outDirSet = true
      index += 1
      continue
    }

    if (arg === '--path') {
      if (!next) fail('--path requires a directory')
      options.outDir = next
      options.outDirSet = true
      index += 1
      continue
    }

    if (arg === '--clear') {
      options.clear = true
      continue
    }

    if (arg === '--all') {
      options.all = true
      continue
    }

    if (arg === '--single') {
      options.single = true
      continue
    }

    if (arg === '--max-pages') {
      if (!next) fail('--max-pages requires a number')
      options.maxPages = Number(next)
      index += 1
      continue
    }

    if (arg === '--items') {
      if (!next) fail('--items requires indexes, for example 1,3,5')
      options.items = next
      index += 1
      continue
    }

    if (arg === '--width') {
      if (!next) fail('--width requires a number')
      options.width = Number(next)
      index += 1
      continue
    }

    if (arg === '--height') {
      if (!next) fail('--height requires a number')
      options.height = Number(next)
      index += 1
      continue
    }

    fail(`Unknown option: ${arg}`)
  }

  return options
}

export const parseInstallTarget = (argv) => {
  const targetIndex = argv.indexOf('--target')
  const target = targetIndex === -1 ? 'codex' : argv[targetIndex + 1]

  if (!['codex', 'claude', 'both'].includes(target)) {
    fail('--target must be codex, claude, or both')
  }

  return target
}
