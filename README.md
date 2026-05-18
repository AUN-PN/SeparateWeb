# SeparateWeb Capture

SeparateWeb Capture เป็น Codex plugin สำหรับเก็บหน้าเว็บเป็นชุด asset ที่ใช้ต่อได้ทันที: full-page screenshot, cropped UI item PNGs, และ JSON manifests.

ใช้เมื่ออยากให้ Codex เปิด URL, capture layout จริง, แยกชิ้นส่วน UI, แล้วส่ง path ของผลลัพธ์กลับมาให้เอาไปอ้างอิงในงาน design, frontend implementation, หรือ visual QA.

## Status

- Plugin-only repository
- ไม่ใช้ Nuxt, Cloudflare Worker, หรือ web UI
- License: MIT
- Runtime script: `plugins/separateweb-capture/scripts/capture.mjs`

## What It Does

- Capture full-page screenshots
- Crop UI elements into `items/<kind>/*.png`
- Write per-page `manifest.json`
- Write crawl-level `site-manifest.json`
- Crawl same-origin paths from root URLs
- Capture one page with `--single`

## Plugin Layout

```text
plugins/separateweb-capture/
  .codex-plugin/plugin.json
  skills/separateweb-capture/SKILL.md
  scripts/capture.mjs
  assets/
  README.md
  LICENSE
```

Codex reads `.codex-plugin/plugin.json` as the plugin manifest. The skill file tells Codex when this plugin applies and which script command to run.

## Quick Start In Codex

Ask Codex:

```text
separateweb capture https://example.com
separateweb capture https://example.com/docs --single
separateweb patch /Users/onecrop/Desktop/patches
```

Codex skill:

```text
plugins/separateweb-capture/skills/separateweb-capture/SKILL.md
```

## Codex Commands

```bash
separateweb capture <url> [--out <dir>] [--width <px>] [--height <px>] [--max-pages <n>] [--single|--all]
separateweb patch <dir>
separateweb patch --clear
separateweb select <manifest.json>
separateweb create <manifest.json> --items <indexes> --path <dir>
```

## Capture Rules

- `capture https://example.com` crawls same-origin paths.
- `capture https://example.com/` crawls same-origin paths.
- `capture https://example.com --single` captures only the root page.
- `capture https://example.com/docs` captures only `/docs`.
- `capture https://example.com/docs --all` crawls same-origin paths starting from `/docs`.
- `--max-pages` accepts `1` to `200`.

## Output

Root crawl:

```text
captures/<jobId>/site-manifest.json
captures/<jobId>/page-001-<slug>/full-page.png
captures/<jobId>/page-001-<slug>/manifest.json
captures/<jobId>/page-001-<slug>/items/<kind>/*.png
```

Single page:

```text
captures/<jobId>/site-manifest.json
captures/<jobId>/full-page.png
captures/<jobId>/manifest.json
captures/<jobId>/items/<kind>/*.png
```

## Validation

```bash
cd plugins/separateweb-capture
npm run check
node scripts/capture.mjs --help
```

## Help And Ownership

Open an issue or inspect:

```text
plugins/separateweb-capture/README.md
plugins/separateweb-capture/skills/separateweb-capture/SKILL.md
plugins/separateweb-capture/.codex-plugin/plugin.json
```

Maintainer: `onecrop`

## License

MIT. See [LICENSE](./LICENSE) and [plugins/separateweb-capture/LICENSE](./plugins/separateweb-capture/LICENSE).
