# SeparateWeb Capture

Capture a URL into screenshots, UI item crops, and JSON manifests from Codex or the local CLI.

## What This Plugin Contains

```text
.codex-plugin/plugin.json          Codex plugin manifest
skills/separateweb-capture/SKILL.md Codex skill trigger and workflow
scripts/capture.mjs                Playwright + Sharp capture CLI
assets/icon.png                    Composer icon
assets/logo.png                    Plugin logo
```

The required Codex entrypoint is `.codex-plugin/plugin.json`. The skill in `skills/separateweb-capture/SKILL.md` tells Codex when to run this plugin and which script command to use.

## Install

```bash
npm install
```

Optional global command for local development:

```bash
npm link
```

## Codex Usage

Ask Codex:

```text
separateweb capture https://example.com
separateweb capture https://example.com --single
separateweb capture https://example.com/docs
separateweb capture https://example.com/docs --all
separateweb patch /Users/onecrop/Desktop/patches
```

Codex should run the script from this plugin root:

```bash
node scripts/capture.mjs capture <url>
node scripts/capture.mjs patch <dir>
```

## CLI Usage

```bash
separateweb capture <url> [--out <dir>] [--width <px>] [--height <px>] [--max-pages <n>] [--single|--all]
separateweb patch <dir>
separateweb patch --clear
separateweb select <manifest.json>
separateweb create <manifest.json> --items <indexes> --path <dir>
```

Without `npm link`, use:

```bash
node scripts/capture.mjs capture https://example.com --single
```

## Capture Behavior

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

## Options

```bash
separateweb capture https://example.com --out captures --width 1440 --height 1000 --max-pages 20
separateweb capture https://example.com --single
separateweb capture https://example.com/docs --all
```

## Select And Export Items

```bash
separateweb select captures/<jobId>/page-001-<slug>/manifest.json
separateweb create captures/<jobId>/page-001-<slug>/manifest.json --items 1,3,5 --path /Users/onecrop/Desktop/patches
```

Set the default export path:

```bash
separateweb patch /Users/onecrop/Desktop/patches
```

Clear it:

```bash
separateweb patch --clear
```

## Validate

```bash
npm run check
node scripts/capture.mjs --help
```

## Publish

```bash
npm publish --access public
```

Install from npm:

```bash
npm install -g separateweb-capture
```

## License

MIT. See [LICENSE](./LICENSE).
