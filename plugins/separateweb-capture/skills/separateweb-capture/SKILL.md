---
name: separateweb-capture
description: Capture a URL into a full-page screenshot, cropped UI item PNGs, and a JSON manifest. Use when the user says `separateweb capture <url>`, asks to capture a website, or wants UI extraction assets without running the SeparateWeb web app.
---

# SeparateWeb Capture

Use this skill when the user asks:

```text
separateweb capture <url>
```

Run the plugin script from the plugin root:

```bash
node scripts/capture.mjs capture <url>
```

Optional flags:

```bash
--out <dir>
--path <dir>
--width <px>
--height <px>
```

Patch selection:

```bash
node scripts/capture.mjs select captures/<jobId>/manifest.json
node scripts/capture.mjs patch captures/<jobId>/manifest.json --items 1,3,5 --path /absolute/output/path
```

Use `--path` when the user asks which machine path to place the patch into. `--out` remains supported as an alias.

Default output:

```text
captures/<jobId>/full-page.png
captures/<jobId>/manifest.json
captures/<jobId>/items/*.png
```

After running, report:

- `Captured`
- `Manifest`
- `Blocks`
- exact error if capture failed

Do not start a Nuxt dev server. This plugin is script-only.
