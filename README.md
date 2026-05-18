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
captures/<jobId>/full-page.png
captures/<jobId>/manifest.json
captures/<jobId>/items/*.png
```

เลือก item แล้วสร้าง patch ลง path ในเครื่อง:

```bash
node scripts/capture.mjs patch /Users/onecrop/Desktop/patches
node scripts/capture.mjs select captures/<jobId>/manifest.json
node scripts/capture.mjs create captures/<jobId>/manifest.json --items 1,3,5 --path /Users/onecrop/Desktop/patches
```
