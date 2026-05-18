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
# SeparateWeb
