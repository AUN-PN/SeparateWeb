# SeparateWeb Capture for Claude Code

Use this repo as a script-only capture tool. Do not start a Nuxt or web server.

## Plugin path

```text
plugins/separateweb-capture
```

## Install CLI

```bash
cd plugins/separateweb-capture
npm install
npm link
```

## Set default output path

```bash
separateweb patch /absolute/output/path
```

This writes:

```text
~/.separateweb-capture/config.json
```

## Capture rules

```bash
separateweb capture https://domain.com
# crawl every same-origin path

separateweb capture https://domain.com --single
# capture only the home page

separateweb capture https://domain.com/about
# capture only /about

separateweb capture https://domain.com/about --all
# crawl from /about
```

## Output

```text
<patchPath>/<jobId>/site-manifest.json
<patchPath>/<jobId>/page-001-<slug>/manifest.json
<patchPath>/<jobId>/page-001-<slug>/items/<kind>/*.png
```

Single-page output can write directly under `<patchPath>/<jobId>/`.

## Select from existing manifest

```bash
separateweb select <manifest.json>
separateweb create <manifest.json> --items all --path /absolute/output/path
```
