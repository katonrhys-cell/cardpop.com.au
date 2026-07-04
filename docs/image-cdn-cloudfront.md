# Serving images through AWS CloudFront (free)

## Why

Supabase meters **all** storage egress against the plan's quota — including
requests served from its own CDN cache ("Cached Egress"). CardPop's card
photos, avatars and media all live in Supabase Storage, so image traffic is
what exhausts the free plan's 5 GB/month egress allowance.

AWS CloudFront's **always-free tier is 1 TB/month of egress + 10 million
requests** (it does not expire, unlike the AWS credits-based free plan). By
putting a CloudFront distribution in front of Supabase Storage, repeat image
traffic is served CloudFront→visitor and never touches the Supabase quota —
Supabase only sees the occasional cache-miss refill.

The app already supports this: when the `VITE_IMAGE_CDN_HOST` env var is set,
every image URL the frontend builds points at the CDN instead of Supabase.
When it's unset, everything behaves exactly as before. There is nothing to
maintain — no servers, no database, no code running in AWS.

## Setup (one-off, ~10 minutes)

### 1. Create the CloudFront distribution

In the AWS console → CloudFront → **Create distribution**:

| Setting | Value |
|---|---|
| Origin domain | `odoglvswwymyjuwlonkf.supabase.co` |
| Protocol | HTTPS only |
| Name | `supabase-storage` (anything) |
| Compress objects automatically | Yes |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Allowed HTTP methods | GET, HEAD |
| Cache policy | Custom (next step) |
| Web Application Firewall | Do not enable (it's the paid bit) |
| Price class | Use only North America and Europe is fine, but "All edge locations" includes Australia — pick **All** for AU visitors |

### 2. Cache policy

Create a custom cache policy (CloudFront → Policies → Cache → Create):

- **Name**: `supabase-images`
- **Minimum TTL**: `86400` (1 day) — this overrides the short `max-age=3600`
  header on images uploaded before the cache-header fix, so even old images
  stay cached at the edge.
- **Maximum TTL**: `31536000`, **Default TTL**: `604800`
- **Headers**: include `Accept` only if you later enable Supabase image
  transformations (WebP negotiation); otherwise **None**.
- **Query strings**: **All** (transform URLs use `?width=…&quality=…`).
- **Cookies**: None.
- Enable Gzip and Brotli.

Attach it to the distribution's default behavior.

### 3. (Optional but recommended) Restrict the path

Behavior → Path pattern `/storage/v1/object/public/*` (and another for
`/storage/v1/render/image/public/*` if transformations are ever enabled), so
the distribution can't be used to proxy the Supabase Auth/REST API. If you
skip this, the default behavior forwards everything — it still works, but the
path restriction is tidier. If you do restrict paths, set the default
behavior's response to a low-TTL 403 via a CloudFront function, or just leave
the default behavior pointing at the same origin with caching disabled.

### 4. Wire up the app

The distribution gets a domain like `d1a2b3c4d5e6f7.cloudfront.net`. In the
Vercel dashboard → Settings → Environment Variables, add:

| Variable | Value | Notes |
|---|---|---|
| `VITE_IMAGE_CDN_HOST` | `d1a2b3c4d5e6f7.cloudfront.net` | Frontend (baked in at build time) |
| `IMAGE_CDN_HOST` | `d1a2b3c4d5e6f7.cloudfront.net` | `api/prerender.js` (og:image URLs) |

Then redeploy (push to `main`). To roll back, delete the env vars and
redeploy — image URLs revert to Supabase immediately.

### 5. Verify

```
curl -sI https://d1a2b3c4d5e6f7.cloudfront.net/storage/v1/object/public/vault-images/<some-path>.webp | grep -i 'x-cache\|cache-control'
```

First request shows `X-Cache: Miss from cloudfront`, the second
`Hit from cloudfront`. Hits don't count against Supabase egress.

## What this covers (and what it doesn't)

- **Covered**: every image URL built at render time from a storage path —
  card grids, listing pages, avatars, checkout thumbnails, blog covers —
  plus stored absolute Supabase URLs passed through `publicImageUrl()` /
  `toCdnUrl()` (`utils/imageUrl.js`).
- **Not covered**: absolute Supabase URLs stored in the database and rendered
  directly by an `<img src={row.image_url}>` without going through the helper
  (some admin-uploaded content: category icons, event covers, hero/media
  images). These still resolve to Supabase — the service worker's image cache
  keeps their repeat traffic near zero for returning visitors. If they ever
  become a significant egress source, route them through `publicImageUrl()`
  at render time too.

## Related pieces in this repo

- `utils/imageUrl.js` — `toCdnUrl()` / `publicImageUrl()`, the host swap.
- `public/sw.js` — service worker caches storage images cache-first on the
  client, so returning visitors generate almost no image egress even
  without the CDN.
- Upload sites set `cacheControl: '31536000'` (files are immutable —
  timestamped names), so browsers and CloudFront can cache aggressively.
- `scripts/backfill-image-cache-headers.mjs` — one-off script to re-upload
  pre-existing images with the long cache header (and recompress oversized
  ones if `sharp` is installed).
