---
name: separateweb-capture
description: Capture a URL into a full-page screenshot, cropped UI item PNGs, and a JSON manifest. Use when the user says `separateweb capture <url>`, asks to capture a website, or wants UI extraction assets without running the SeparateWeb web app.
---

# SeparateWeb Capture

Use this skill when the user asks:

```text
separateweb capture <url>
separateweb patch <path>
```

Run the plugin script from the plugin root:

```bash
node scripts/capture.mjs capture <url>
node scripts/capture.mjs patch <path>
```

Optional flags:

```bash
--out <dir>
--path <dir>
--width <px>
--height <px>
--max-pages <n>
--single
--all
```

Capture behavior:

- `capture https://example.com/` crawls same-origin paths by default.
- `capture https://example.com/path` captures only that page by default.
- Use `--single` to force one page.
- Use `--all` to force same-origin crawl from any start URL.
- Captured items are grouped by type under `items/<kind>/`.

Patch selection:

```bash
node scripts/capture.mjs patch /absolute/output/path
node scripts/capture.mjs select captures/<jobId>/manifest.json
node scripts/capture.mjs create captures/<jobId>/manifest.json --items 1,3,5 --path /absolute/output/path
```

Use `patch <path>` to set the default machine path where future `capture` outputs are written. Use `create` only when exporting selected items from an existing manifest.

Default output:

```text
captures/<jobId>/site-manifest.json
captures/<jobId>/page-001-<slug>/full-page.png
captures/<jobId>/page-001-<slug>/manifest.json
captures/<jobId>/page-001-<slug>/items/<kind>/*.png
```

Single-page capture writes `full-page.png`, `manifest.json`, and `items/<kind>/*.png` directly under `captures/<jobId>/`.

After running, report:

- `Captured`
- `Manifest`
- `Blocks`
- exact error if capture failed

Do not start a Nuxt dev server. This plugin is script-only.
