# SeparateWeb Capture

Codex plugin สำหรับ capture หน้าเว็บเป็น asset ที่เอาไปใช้ต่อได้ทันที:

- full-page screenshot
- cropped UI item PNGs
- JSON manifests
- same-origin crawl สำหรับ URL root
- one-page capture สำหรับ URL path หรือ `--single`

Repo นี้เป็น plugin-only ไม่ใช้ Nuxt, Cloudflare Worker, หรือ web UI แล้ว

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

ตาม Codex plugin layout: plugin อยู่ใต้ `plugins/<name>/`, มี `.codex-plugin/plugin.json` เป็น manifest หลัก และมี companion surfaces เช่น `skills/`, `scripts/`, `assets/` ตามที่ plugin ต้องใช้

## Use In Codex

หลังติดตั้ง plugin แล้ว ใช้ prompt:

```text
separateweb capture https://example.com
separateweb capture https://example.com/docs --single
separateweb patch /Users/onecrop/Desktop/patches
```

Skill ที่ Codex โหลด:

```text
plugins/separateweb-capture/skills/separateweb-capture/SKILL.md
```

## Local CLI

```bash
cd plugins/separateweb-capture
npm install
npm run check
npm run capture -- https://example.com --single
```

หรือ link เป็น command:

```bash
cd plugins/separateweb-capture
npm link
separateweb capture https://example.com
```

## Commands

```bash
separateweb capture <url> [--out <dir>] [--width <px>] [--height <px>] [--max-pages <n>] [--single|--all]
separateweb patch <dir>
separateweb patch --clear
separateweb select <manifest.json>
separateweb create <manifest.json> --items <indexes> --path <dir>
```

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

## Publish Package

```bash
cd plugins/separateweb-capture
npm publish --access public
```

Install from npm:

```bash
npm install -g separateweb-capture
```

## License

MIT. See [LICENSE](./LICENSE) and [plugins/separateweb-capture/LICENSE](./plugins/separateweb-capture/LICENSE).
