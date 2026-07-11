# Serving images through a free CDN

## Why

Supabase meters **all** storage egress against the plan's quota — including
requests served from its own CDN cache ("Cached Egress"). CardPop's card
photos, avatars and media all live in Supabase Storage, so image traffic is
what exhausts the free plan's 5 GB/month egress allowance.

The app supports an image CDN out of the box: when the `VITE_IMAGE_CDN_HOST`
env var is set, every image URL the frontend builds points at the CDN instead
of Supabase (`utils/imageUrl.js`), and `api/prerender.js` does the same for
og:image URLs via `IMAGE_CDN_HOST`. When unset, everything behaves exactly as
before. The CDN passes the `/storage/v1/...` path through verbatim, so only
the hostname changes.

Two free options below. **Option A (Cloudflare) is the one in use** — the
`cardpop.com.au` zone already lives on Cloudflare, so the image host is a
first-party subdomain with unmetered bandwidth. Option B (CloudFront) is kept
as the no-code alternative.

## Option A — Cloudflare Worker on `img.cardpop.com.au` (in use)

The Worker source is `cloudflare/image-proxy-worker.js` (this repo is the
source of truth — if the Worker ever changes, edit it here and re-paste). It
proxies `/storage/v1/object/public/*` to Supabase and caches responses at
Cloudflare's edge for a year. It also canonicalises query strings before
fetching the origin (stripped entirely on object paths; transform params
allowlisted, ladder-snapped and sorted on render paths), so cache-busting
query strings can't be used to replay origin egress — see the comments in the
Worker source and `docs/ddos-protection.md`. Free-tier limit: 100k requests/day — the app's
service worker means each visitor fetches each image roughly once ever, so
this is ample headroom.

### Setup (~10 minutes, all in the Cloudflare dashboard)

1. **Create the Worker**: Cloudflare dashboard → Workers & Pages → Create →
   Worker. Name it `cardpop-image-proxy`, deploy the hello-world, then Edit
   code → replace with the contents of `cloudflare/image-proxy-worker.js` →
   Deploy.
2. **Attach the domain**: Worker → Settings → Domains & Routes → Add →
   Custom domain → `img.cardpop.com.au`. Cloudflare creates the DNS record
   and TLS certificate automatically (this is why a Custom Domain beats a
   manually-added route).
3. **Verify the proxy** (grab any card image path from the site or the
   Supabase dashboard):
   ```
   curl -sI "https://img.cardpop.com.au/storage/v1/object/public/vault-images/<some-path>.webp" | grep -i "cf-cache-status\|cache-control"
   ```
   First request: `cf-cache-status: MISS`. Second: `HIT`. Hits never touch
   Supabase.
4. **Point the app at it**: Vercel dashboard → Settings → Environment
   Variables (Production):

   | Variable | Value |
   |---|---|
   | `VITE_IMAGE_CDN_HOST` | `img.cardpop.com.au` |
   | `IMAGE_CDN_HOST` | `img.cardpop.com.au` |

5. **Redeploy** (push to `main`, or Vercel → Deployments → Redeploy).
   `VITE_*` vars are baked in at build time, so a redeploy is required.
6. **Confirm on the site**: open cardpop.com.au, DevTools → Network → Img —
   card images should load from `img.cardpop.com.au`.

**Rollback**: delete the two env vars and redeploy — image URLs revert to
Supabase immediately. The Worker can stay deployed; it costs nothing.

### R2 fast path (free egress for migrated objects)

The Worker also serves objects straight from a Cloudflare **R2 bucket** when one
is bound as `IMAGES`. R2 has **no egress fee at all**, so any object served from
R2 costs nothing — not against Supabase's quota, not against Cloudflare. This is
strictly better than the Supabase proxy (which still pays Supabase egress on
every edge-cache miss).

How it works: an `/storage/v1/object/public/<bucket>/<path>` request is looked up
in R2 under the key `<bucket>/<path>` — the exact suffix the public URL already
carries — so **no URL changes and no frontend changes are needed**. A hit is
served from R2; a **miss falls through to the Supabase proxy**, so objects can be
migrated one at a time and the change is fully reversible (delete from R2 →
requests fall back to Supabase). Transform requests
(`/storage/v1/render/image/public/`) are never served from R2 — R2 can't resize —
so they always proxy to Supabase.

**Lazy write-through migration:** the Worker doesn't just *read* from R2 — the
first successful Supabase proxy of an object also *copies* its bytes into R2 in
the background (the response is `tee()`d: one half streams to the client, the
other is written to R2 via `ctx.waitUntil`). So every object migrates itself the
first time it's viewed, and every request after that is served from the R2 fast
path for free. Net migration cost is **one Supabase read per object, once**, and
only for objects actually viewed — cold objects nobody looks at are never copied
(and cost no egress anyway). This means new uploads need **no write-path change**:
they land in Supabase as they always have, then migrate to R2 on first view.
Write-through is skipped for HEAD requests, non-2xx responses, and render/transform
paths.

The binding is optional: with no `IMAGES` binding the Worker behaves exactly as
the Supabase-only proxy did. See `tests/backend/imageProxyWorker.test.js` for the
covered behaviours.

**Bind the bucket (Cloudflare dashboard, ~2 min):**

1. Create the R2 bucket `cardpop-images` (R2 → Create bucket; APAC/Oceania
   location for AU proximity). *(Already done.)*
2. Worker `cardpop-image-proxy` → **Settings → Bindings → Add → R2 bucket**.
   - **Variable name**: `IMAGES` (must match exactly — the code reads
     `env.IMAGES`).
   - **R2 bucket**: `cardpop-images`.
3. Re-deploy the Worker with the current `cloudflare/image-proxy-worker.js`
   (Worker → Edit code → paste → Deploy). The binding only takes effect once the
   R2-aware code is deployed.
4. Verify: upload a test object to R2 under a real key (e.g.
   `vault-images/<some-existing-path>.webp`), then
   `curl -sI https://img.cardpop.com.au/storage/v1/object/public/vault-images/<that-path>.webp`.
   It should return the R2 object; a key not in R2 should still return the
   Supabase-served image.

**Backfill (optional pre-warm):** write-through already migrates each object the
first time it's viewed, so no backfill is strictly required — the bucket fills
itself as the site is used. To migrate everything up front (so even the first
visitor gets the free R2 copy), run `scripts/backfill-images-to-r2.mjs`. It lists
every object in the public buckets and requests each once through the CDN, which
drives the same write-through — so it needs **no R2 credentials**, only the
Supabase service-role key to list, and the Worker must already have the `IMAGES`
binding:

```
SUPABASE_URL=https://odoglvswwymyjuwlonkf.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/backfill-images-to-r2.mjs --dry-run   # preview
# then drop --dry-run to run for real
```

It reports how many objects it warmed vs. how many were already in R2 (via the
`x-image-source: r2` response header), costs one Supabase read per not-yet-migrated
object, and is safe to re-run.

Pointing new uploads at R2 is **not** a separate task: because write-through
migrates on first view, new uploads land in Supabase as before and move to R2 the
first time they're shown — no upload-path change needed.

## Option B — AWS CloudFront (alternative, no code)

CloudFront's always-free tier is 1 TB/month egress + 10M requests and does
not expire. No Worker code — pure console configuration:

1. CloudFront → Create distribution: origin `odoglvswwymyjuwlonkf.supabase.co`
   (HTTPS only), GET/HEAD, compress on, redirect HTTP→HTTPS, price class
   "All" (includes Australia).
2. Custom cache policy: min TTL `86400`, max `31536000`, default `604800`;
   query strings **All**; headers/cookies **None**; Gzip+Brotli on.
3. Optionally restrict behaviors to `/storage/v1/object/public/*` so the
   distribution can't proxy the Supabase Auth/REST API.
4. Set `VITE_IMAGE_CDN_HOST` / `IMAGE_CDN_HOST` to the distribution domain
   (`dxxxxxxxx.cloudfront.net`) in Vercel and redeploy.

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

## Outage fallback (self-healing)

The CDN host is a single point of failure: if `img.cardpop.com.au` stops
serving objects (Worker/route misconfig, an edge incident, a bad
`VITE_IMAGE_CDN_HOST`), every image built through it would 404/error at once —
even though the objects are still readable straight from Supabase Storage. Two
layers recover from this automatically, so a CDN problem degrades to "images
load from Supabase directly" instead of "site full of broken thumbnails":

- **`CardImage`** (grids/listings) tries `src` → `fallbackSrc` (both CDN) →
  `canonicalSrc` (the non-CDN Supabase origin from `getCardImage`) before
  showing "No Image".
- **`utils/imageCdnFallback.js`** installs one global capture-phase `error`
  listener (`installImageCdnFallback()` in `main.jsx`). The first time any raw
  `<img>` served from the CDN host fails, it rewrites the src back to the
  Supabase origin via `canonicalStorageUrl()` and retries once — covering every
  raw `<img>` on the site without a per-call-site handler. `CardImage` opts out
  (`data-managed-image`) since it runs its own richer fallback.

The trade-off is deliberate: a working image (served from Supabase, metered
egress) beats a broken one. Fix the CDN (or clear `VITE_IMAGE_CDN_HOST`) to
return traffic to the edge.

## Related pieces in this repo

- `cloudflare/image-proxy-worker.js` — the Worker source (Option A).
- `utils/imageUrl.js` — `toCdnUrl()` / `publicImageUrl()`, the host swap;
  `canonicalStorageUrl()` / `getCardImage().canonicalSrc`, the outage fallback.
- `utils/imageCdnFallback.js` — global CDN→origin `<img>` recovery listener.
- `public/sw.js` — service worker caches storage images cache-first on the
  client, so returning visitors generate almost no image egress even
  without the CDN.
- Upload sites set `cacheControl: '31536000'` (files are immutable —
  timestamped names), so browsers and CDNs can cache aggressively.
- `scripts/backfill-image-cache-headers.mjs` — one-off script to re-upload
  pre-existing images with the long cache header (and recompress oversized
  ones if `sharp` is installed).
- `scripts/backfill-images-to-r2.mjs` — one-off pre-warm that drives the
  Worker's write-through to migrate every existing object into R2 (no R2
  credentials needed).
