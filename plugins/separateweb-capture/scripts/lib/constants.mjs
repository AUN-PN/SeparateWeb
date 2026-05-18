import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_VIEWPORT = { width: 1440, height: 1000 }
export const DEFAULT_OUT_DIR = 'captures'
export const CONFIG_DIR = join(homedir(), '.separateweb-capture')
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json')
export const CODEX_SKILLS_DIR = join(homedir(), '.codex', 'skills')
export const CLAUDE_SKILLS_DIR = join(homedir(), '.claude', 'skills')
export const MAX_ITEMS = 240
export const DEFAULT_MAX_PAGES = 20
export const SKILL_NAME = 'separateweb-capture'

const LIB_DIR = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = dirname(LIB_DIR)

export const PACKAGE_ROOT = dirname(SCRIPTS_DIR)
export const SKILL_SOURCE_DIR = join(PACKAGE_ROOT, 'skills', SKILL_NAME)
