# SeparateWeb Capture

SeparateWeb Capture is a Codex plugin that turns web pages into inspectable visual assets: full-page screenshots, grouped UI crops, and JSON manifests.

Use it when Codex needs real page evidence before implementing or reviewing UI.

## Status

- Plugin name: `separateweb-capture`
- Version: `1.0.0`
- License: MIT
- Runtime: Node.js `>=18`
- Capture engine: Playwright + Sharp

## Install With npx

Run this plugin from the repository root:

```bash
npx --yes ./plugins/separateweb-capture --help
npx --yes ./plugins/separateweb-capture capture https://example.com --single
```

Run it by package name when your npm registry has `separateweb-capture`:

```bash
npx --yes separateweb-capture capture https://example.com --single
```

Set a default destination:

```bash
npx --yes ./plugins/separateweb-capture patch /absolute/output/path
```

## Install As A Codex Plugin

Use the marketplace file at the repository root:

```text
.agents/plugins/marketplace.json
```

Then install:

```text
separateweb-capture
```

After installation, start a new Codex session and ask:

```text
separateweb capture https://example.com --single
```

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
