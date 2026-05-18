# SeparateWeb Capture

Website screenshot, web page capture, and UI crop extraction for Codex.

SeparateWeb Capture is a Codex plugin that turns web pages into inspectable visual assets: full-page screenshots, grouped UI crops, and JSON manifests.

Use it when Codex needs real page evidence before implementing or reviewing UI.

## Status

- Plugin name: `separateweb-capture`
- Version: `1.0.0`
- License: MIT
- Runtime: Node.js `>=18`
- Capture engine: Playwright + Sharp

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

## Use

Set a default destination for future captures:

```bash
$separateweb-capture patch /absolute/output/path
```

Capture one page:

```bash
$separateweb-capture https://example.com --single
```

Capture a root URL and crawl same-origin pages:

```bash
$separateweb-capture https://example.com
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

## What's Included

```text
.codex-plugin/plugin.json           Codex plugin manifest
skills/separateweb-capture/SKILL.md Codex skill trigger and workflow
scripts/capture.mjs                 Capture script
assets/icon.png                     Composer icon
assets/logo.png                     Plugin logo
LICENSE                             MIT license
```

The required Codex entrypoint is `.codex-plugin/plugin.json`. The skill in `skills/separateweb-capture/SKILL.md` defines when Codex should use this plugin.

## Use Cases

- Website screenshot tool for frontend teams
- Playwright screenshot capture for visual QA
- UI crop extraction from live web pages
- Web design asset capture for implementation references
- AI coding agent visual context from real URLs
- Codex plugin for webpage inspection

## Codex Usage

Ask Codex:

```text
separateweb capture https://example.com
separateweb capture https://example.com --single
separateweb capture https://example.com/docs
separateweb capture https://example.com/docs --all
separateweb patch /absolute/output/path
```

Codex should run the script from this plugin root:

```bash
node scripts/capture.mjs capture <url>
node scripts/capture.mjs patch <dir>
```

## Commands

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

## Selection Workflow

List manifest items:

```bash
separateweb select captures/<jobId>/page-001-<slug>/manifest.json
```

Export selected items:

```bash
separateweb create captures/<jobId>/page-001-<slug>/manifest.json --items 1,3,5 --path /absolute/output/path
```

Set the default export path:

```bash
separateweb patch /absolute/output/path
```

Clear it:

```bash
separateweb patch --clear
```

## Troubleshooting

- If capture fails, report the exact error from `scripts/capture.mjs`.
- If output is missing, check the printed `Manifest` path first.
- If selected items do not export, confirm the manifest path and `--items` indexes.

## License

MIT. See [LICENSE](./LICENSE).
