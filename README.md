# SeparateWeb Capture

SeparateWeb Capture is a Codex plugin for capturing web pages as ready-to-use visual assets: full-page screenshots, cropped UI item PNGs, and JSON manifests.

Use it when Codex needs to open a URL, capture the real layout, extract UI pieces, and return output paths for design, frontend implementation, or visual QA.

## Status

- Plugin-only repository
- Does not use Nuxt, Cloudflare Worker, or a web UI
- License: MIT
- Runtime script: `plugins/separateweb-capture/scripts/capture.mjs`

## Install With npx

Run from a checked-out copy of this repository:

```bash
npx --yes ./plugins/separateweb-capture --help
npx --yes ./plugins/separateweb-capture capture https://example.com --single
```

Run from the npm package name when it is available in your registry:

```bash
npx --yes separateweb-capture capture https://example.com --single
```

Use `patch` to set a default destination before capture:

```bash
npx --yes ./plugins/separateweb-capture patch /absolute/output/path
```

## Install As A Codex Plugin

This repository includes a local Codex marketplace file:

```text
.agents/plugins/marketplace.json
```

That marketplace exposes:

```text
separateweb-capture
```

Install flow:

1. Open Codex plugin settings.
2. Add the local marketplace from `.agents/plugins/marketplace.json`.
3. Install `separateweb-capture`.
4. Start a new Codex session so the skill list refreshes.
5. Ask Codex to run `separateweb capture https://example.com --single`.

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
