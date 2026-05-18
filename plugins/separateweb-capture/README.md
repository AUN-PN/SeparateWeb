# SeparateWeb Capture

Codex plugin สำหรับ capture หน้าเว็บเป็น asset ชุดเล็ก:

- `full-page.png`
- `manifest.json`
- `items/<kind>/*.png`
- plugin icon: `assets/icon.png`

## Local test

```bash
npm install
npm run capture -- https://example.com
```

## npm CLI

ติดตั้งจากโฟลเดอร์นี้:

```bash
npm install
npm link
```

ใช้:

```bash
separateweb patch /Users/onecrop/Desktop/patches
separateweb capture https://domain.com
separateweb capture https://domain.com --single
separateweb capture https://domain.com/docs
separateweb capture https://domain.com/docs --all
```

publish:

```bash
npm publish --access public
```

ติดตั้งจาก npm:

```bash
npm install -g separateweb-capture
```

## Claude Code

Claude Code ใช้คู่มือใน `CLAUDE.md`

คำสั่งหลัก:

```bash
separateweb patch /Users/onecrop/Desktop/patches
separateweb capture https://domain.com --single
```

## Set capture path

```bash
node scripts/capture.mjs patch /Users/onecrop/Desktop/patches
node scripts/capture.mjs capture https://example.com
```

หลังตั้งค่า `patch <path>` แล้ว ทุกครั้งที่ `capture` จะลงใน path นั้นโดย default

ค่า default ของ `capture`:

- URL root เช่น `https://example.com` หรือ `https://example.com/` จะ crawl ทุก path ใน origin เดียวกัน
- ถ้าต้องการแคปเฉพาะหน้าแรก ให้ใช้ `--single`
- URL มี path เช่น `https://example.com/docs` จะแคปเฉพาะหน้านั้น
- item crops แยกตาม type ใน `items/<kind>/`

ตัวอย่าง:

```bash
node scripts/capture.mjs capture https://domain.com
# crawl ทุก path

node scripts/capture.mjs capture https://domain.com --single
# แคปเฉพาะหน้าแรก

node scripts/capture.mjs capture https://domain.com/docs
# แคปเฉพาะ /docs

node scripts/capture.mjs capture https://domain.com/docs --all
# crawl จาก /docs
```

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
