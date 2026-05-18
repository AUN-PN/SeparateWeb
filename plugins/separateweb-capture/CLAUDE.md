# SeparateWeb Capture

Claude Code instructions for this package.

## Do

- Use `separateweb` after `npm link`, or `node scripts/capture.mjs` inside this folder.
- Use `patch <path>` to set the default output path for future captures.
- Use `--single` when the user wants only the home page from `https://domain.com`.
- Keep captured item folders grouped by kind: `items/<kind>/*.png`.

## Commands

```bash
npm install
npm link
separateweb patch /Users/onecrop/Desktop/patches
separateweb capture https://domain.com
separateweb capture https://domain.com --single
separateweb capture https://domain.com/about
separateweb capture https://domain.com/about --all
```

## Direct script

```bash
node scripts/capture.mjs patch /Users/onecrop/Desktop/patches
node scripts/capture.mjs capture https://domain.com --single
```

## Existing manifest

```bash
separateweb select <manifest.json>
separateweb create <manifest.json> --items 1,3,5 --path /Users/onecrop/Desktop/patches
```
