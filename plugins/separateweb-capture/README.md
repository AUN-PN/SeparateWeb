# SeparateWeb Capture

Codex plugin สำหรับ capture หน้าเว็บเป็น asset ชุดเล็ก:

- `full-page.png`
- `manifest.json`
- `items/*.png`

## Local test

```bash
npm install
npm run capture -- https://example.com
```

## Options

```bash
npm run capture -- https://example.com -- --out captures --width 1440 --height 1000
```

## Select and patch

```bash
node scripts/capture.mjs select captures/<jobId>/manifest.json
node scripts/capture.mjs patch captures/<jobId>/manifest.json --items 1,3,5 --path /Users/onecrop/Desktop/patches
```
