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

## Set capture path

```bash
node scripts/capture.mjs patch /Users/onecrop/Desktop/patches
node scripts/capture.mjs capture https://example.com
```

หลังตั้งค่า `patch <path>` แล้ว ทุกครั้งที่ `capture` จะลงใน path นั้นโดย default

## Options

```bash
npm run capture -- https://example.com -- --out captures --width 1440 --height 1000
```

## Select and patch

```bash
node scripts/capture.mjs select captures/<jobId>/manifest.json
node scripts/capture.mjs create captures/<jobId>/manifest.json --items 1,3,5 --path /Users/onecrop/Desktop/patches
```
