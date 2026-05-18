# SeparateWeb Capture

Codex plugin สำหรับ capture หน้าเว็บเป็น asset ชุดเล็ก:

- `full-page.png`
- `manifest.json`
- `items/<kind>/*.png`

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

ค่า default ของ `capture`:

- URL root เช่น `https://example.com/` จะ crawl ทุก path ใน origin เดียวกัน
- URL มี path เช่น `https://example.com/docs` จะแคปเฉพาะหน้านั้น
- item crops แยกตาม type ใน `items/<kind>/`

Root crawl output:

```text
captures/<jobId>/site-manifest.json
captures/<jobId>/page-001-<slug>/manifest.json
captures/<jobId>/page-001-<slug>/items/<kind>/*.png
```

Single page output:

```text
captures/<jobId>/site-manifest.json
captures/<jobId>/manifest.json
captures/<jobId>/items/<kind>/*.png
```

## Options

```bash
npm run capture -- https://example.com -- --out captures --width 1440 --height 1000 --max-pages 20
npm run capture -- https://example.com -- --single
npm run capture -- https://example.com/docs -- --all
```

## Select and patch

```bash
node scripts/capture.mjs select captures/<jobId>/page-001-<slug>/manifest.json
node scripts/capture.mjs create captures/<jobId>/page-001-<slug>/manifest.json --items 1,3,5 --path /Users/onecrop/Desktop/patches
```
