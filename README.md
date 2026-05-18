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

## Run With npx

Run capture without installing globally:

```bash
npx separateweb-capture capture https://example.com --single
```

Set a default destination for future captures:

```bash
npx separateweb-capture patch /absolute/output/path
```

Preview available commands:

```bash
npx separateweb-capture --help
```

Run from a checked-out copy of this repository:

```bash
npx --yes ./plugins/separateweb-capture capture https://example.com --single
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

The `npx` command runs the capture CLI only; it does not add the Codex plugin marketplace entry.

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
