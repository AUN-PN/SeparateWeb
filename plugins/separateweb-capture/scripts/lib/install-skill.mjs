import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { CLAUDE_SKILLS_DIR, CODEX_SKILLS_DIR, SKILL_NAME, SKILL_SOURCE_DIR } from './constants.mjs'

export const installLocalSkill = async (target) => {
  const targets = target === 'both'
    ? [
        ['Codex', join(CODEX_SKILLS_DIR, SKILL_NAME)],
        ['Claude', join(CLAUDE_SKILLS_DIR, SKILL_NAME)]
      ]
    : target === 'claude'
      ? [['Claude', join(CLAUDE_SKILLS_DIR, SKILL_NAME)]]
      : [['Codex', join(CODEX_SKILLS_DIR, SKILL_NAME)]]

  for (const [, skillPath] of targets) {
    await mkdir(dirname(skillPath), { recursive: true })
    await cp(SKILL_SOURCE_DIR, skillPath, { recursive: true, force: true })
  }

  console.log('Installed SeparateWeb Capture skill:')
  targets.forEach(([label, skillPath]) => {
    console.log(`- ${label}: ${skillPath}`)
  })
  console.log('Use: npx separateweb-capture capture https://example.com --single')
}
