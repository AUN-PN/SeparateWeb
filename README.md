# -UI-CONTROL-SeparateWeb

## Extraction service split

Cloudflare hosts the Nuxt app. `/api/extract` must run on a separate Node service because `playwright` and `sharp` are not supported in the Cloudflare Worker runtime.

### Cloudflare app

Set these environment variables:

```bash
EXTRACT_SERVICE_URL=https://your-node-service.example.com
EXTRACT_SERVICE_TOKEN=replace-with-a-long-random-token
```

`EXTRACT_SERVICE_URL` can be the service origin or the full endpoint:

```bash
EXTRACT_SERVICE_URL=https://your-node-service.example.com/api/extract
```

### Node extraction service

Deploy the same repo to a Node runtime with:

```bash
npm ci
NITRO_PRESET=node-server npm run build
node .output/server/index.mjs
```

Set the same token:

```bash
EXTRACT_SERVICE_TOKEN=replace-with-a-long-random-token
ALLOW_PRIVATE_CAPTURE=false
ALLOW_FILE_CAPTURE=false
```

For local Node testing:

```bash
NITRO_PRESET=node-server npm run build
EXTRACT_SERVICE_TOKEN=dev-token node .output/server/index.mjs
```

Then call the Node service:

```bash
curl -X POST http://localhost:3000/api/extract \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer dev-token' \
  --data '{"url":"https://example.com"}'
```
