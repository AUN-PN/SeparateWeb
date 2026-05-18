# SeparateWeb Capture

Website screenshot and UI crop extraction for Codex.

SeparateWeb Capture is a Codex plugin for capturing web pages as ready-to-use visual assets: full-page screenshots, cropped UI item PNGs, and JSON manifests.

Use it when Codex needs to open a URL, capture the real layout, extract UI pieces, and return output paths for design, frontend implementation, or visual QA.

## Status

- Plugin-only repository
- Does not use Nuxt, Cloudflare Worker, or a web UI
- License: MIT
- Runtime script: `plugins/separateweb-capture/scripts/capture.mjs`

## Install As A Codex Plugin

In Codex, open Plugins, choose Add marketplace, then use:

```text
Source:
https://github.com/AUN-PN/SeparateWeb.git

Git ref:
main

Sparse paths:
```

Leave `Sparse paths` empty.

The Codex marketplace metadata lives at:

```text
.agents/plugins/marketplace.json
plugins/separateweb-capture/.codex-plugin/plugin.json
plugins/separateweb-capture/skills/separateweb-capture/SKILL.md
```

After adding the marketplace, install or enable `SeparateWeb Capture` from the Codex Plugins list.

## Install As A Local Skill

Requirements:

```text
Node.js >=18
npm with npx
```

Install the skill payload with `npx`:

```bash
npx separateweb-capture
```

Install to both Codex and Claude-style skill folders:

```bash
npx separateweb-capture --target both
```

Targets:

```text
--target codex   installs to ~/.codex/skills/separateweb-capture
--target claude  installs to ~/.claude/skills/separateweb-capture
--target both    installs to both folders
```

## Use With npx

Capture one page:

```bash
npx --yes --package separateweb-capture@latest separateweb capture https://example.com --single
```

Capture a root URL and crawl same-origin pages:

```bash
npx --yes --package separateweb-capture@latest separateweb capture https://example.com
```

Set a default destination for future captures:

```bash
npx --yes --package separateweb-capture@latest separateweb patch /absolute/output/path
```

List captured items from a manifest:

```bash
npx --yes --package separateweb-capture@latest separateweb select captures/<jobId>/manifest.json
```

Export selected items:

```bash
npx --yes --package separateweb-capture@latest separateweb create captures/<jobId>/manifest.json --items 1,3,5 --path /absolute/output/path
```

Preview available commands:

```bash
npx --yes --package separateweb-capture@latest separateweb --help
```

Supported command options:

```text
--out <dir>
--width <px>
--height <px>
--max-pages <n>
--single
--all
--help
```

The package binaries are `separateweb` and `separateweb-capture`. Use `separateweb-capture` to install the local skill payload. Use `separateweb` to run capture commands through `npx`.

## What It Does

- Capture full-page screenshots
- Crop UI elements into `items/<kind>/*.png`
- Write per-page `manifest.json`
- Write crawl-level `site-manifest.json`
- Crawl same-origin paths from root URLs
- Capture one page with `--single`

## Use Cases

- Website screenshot automation for UI review
- Playwright screenshot capture for frontend reference
- UI crop extraction from live web pages
- Visual QA evidence for design implementation
- Web page capture for AI coding agents
- Codex plugin workflow for UI inspection

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
separateweb patch /absolute/output/path
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

## License

MIT License.
