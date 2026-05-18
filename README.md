# SeparateWeb Capture Codex Plugin

Repo นี้เหลือเป็น Codex plugin สำหรับ capture หน้าเว็บด้วย Playwright + Sharp
ไม่ใช้ Nuxt, Cloudflare Worker, หรือเว็บ UI แล้ว

## Plugin

```text
plugins/separateweb-capture
```

## ใช้ใน Codex

หลังติดตั้ง plugin ให้สั่ง:

```text
separateweb patch /Users/onecrop/Desktop/patches
separateweb capture https://demo.separateweb.dev/orbit-store
```

## ใช้ script ตรง

```bash
cd plugins/separateweb-capture
npm install
npm run capture -- https://example.com
```

ผลลัพธ์:

```text
captures/<jobId>/site-manifest.json
captures/<jobId>/page-001-<slug>/full-page.png
captures/<jobId>/page-001-<slug>/manifest.json
captures/<jobId>/page-001-<slug>/items/<kind>/*.png
```

ถ้าเป็นหน้าเดียว output จะอยู่ตรง `captures/<jobId>/full-page.png`,
`captures/<jobId>/manifest.json`, `captures/<jobId>/items/<kind>/*.png`

Default:

- `capture https://example.com` หรือ `capture https://example.com/` = crawl ทุก path ในเว็บเดียวกัน
- `capture https://example.com --single` = แคปเฉพาะหน้าแรก
- `capture https://example.com/path` = แคปเฉพาะ path นั้น
- ใช้ `--single` เพื่อบังคับแคปหน้าเดียว
- ใช้ `--all` เพื่อบังคับ crawl จาก path ใดก็ได้

ตัวอย่างเลือกโหมด:

```bash
separateweb capture https://domain.com
# crawl ทุก path

separateweb capture https://domain.com --single
# แคปเฉพาะหน้าแรก

separateweb capture https://domain.com/about
# แคปเฉพาะ /about

separateweb capture https://domain.com/about --all
# crawl จาก /about
```

เลือก item แล้วสร้าง patch ลง path ในเครื่อง:

```bash
node scripts/capture.mjs patch /Users/onecrop/Desktop/patches
node scripts/capture.mjs select captures/<jobId>/page-001-<slug>/manifest.json
node scripts/capture.mjs create captures/<jobId>/page-001-<slug>/manifest.json --items 1,3,5 --path /Users/onecrop/Desktop/patches
```
