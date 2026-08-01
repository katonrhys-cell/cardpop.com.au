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

## Image transformations (off by default)

Supabase Storage can server-side resize images via its `/storage/v1/render/image/`
endpoint (the `?width=…&resize=cover&quality=…` params `getCardImage` builds).
It's a **paid** Storage feature, and it is **disabled on this project** — the
render endpoint returns `403` when it isn't enabled on the plan. Because a card
grid requests one transformed image per card on first paint, leaving it on
produced a burst of `403`s in the Supabase logs on every fresh page load (the
images still displayed via the untransformed fallback, but each load hammered
the render endpoint first).

So transforms are gated behind a build-time flag, **default off**:

- `VITE_SUPABASE_IMAGE_TRANSFORMS` — unset/false (default): `utils/imageUrl.js`
  never emits a `/render/image` URL; `getCardImage` serves the untransformed
  public object URL directly (still CDN-routed via `VITE_IMAGE_CDN_HOST`). No
  `403`s, no wasted first-load requests. Set it to `true` **only** after
  enabling image transformations in the Supabase dashboard
  (Storage → Settings → Image Transformations, requires a paid plan) — then the
  responsive `srcSet` resizing switches back on.

Even with the flag on, the old graceful-degradation path still applies: a failed
transform flips a session flag and `CardImage` falls back to the original.

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

### Card-art passthrough (`/card-art` — insulate third-party card CDNs)

The card analytics / market-movers thumbnails resolve official card art from the
free card APIs (Pokémon TCG, Scryfall, YGOPRODeck) server-side — see
`src/utils/cardImageResolver.js`. Those images live on the APIs' **own** CDNs, so
serving them costs nothing against Supabase egress, but it leaves us dependent on
those CDNs staying up. The Worker's `/card-art` route removes that dependency by
caching the art in our own R2.

How it works, mirroring the Supabase R2 fast path:

- The resolver, when `CARD_ART_CDN_HOST` is set, rewrites an upstream image URL
  onto `https://<host>/card-art?src=<upstream-url>`. When it's unset the resolver
  returns the raw upstream URL and this route is never hit (the default).
- On request, the Worker validates `src`'s host against a strict allowlist
  (`CARD_ART_HOSTS` — `images.pokemontcg.io`, `cards.scryfall.io`,
  `images.ygoprodeck.com`), then looks it up in R2 under
  `card-art/<host><path>`. **The allowlist is essential** — without it `?src=`
  would make the Worker an open proxy for any URL.
- A hit is served from R2 (`x-image-source: r2-card-art`); a **miss** fetches the
  upstream image, streams it to the client, and `tee()`s a copy into R2 so every
  later request is free and CDN-independent. The R2 key ignores the query string
  (Scryfall appends a `?<version>`) since the path already identifies the
  immutable image.

**Activation is gated on its own var, deliberately.** `CARD_ART_CDN_HOST` is
separate from the always-on `IMAGE_CDN_HOST` so the resolver only starts emitting
`/card-art` URLs *after* you've confirmed the Worker carrying this route is
deployed — otherwise a deploy-order race (Vercel updates the resolver before the
Cloudflare build ships the Worker) would 404 the art. To turn it on: deploy the
Worker (merge to the branch the Git integration builds), confirm `/card-art`
serves, then set `CARD_ART_CDN_HOST=img.cardpop.com.au` in Vercel. To turn it
off, unset it — the resolver instantly reverts to raw upstream URLs. It reuses
the same `IMAGES` R2 binding; no new bucket or binding is needed.

### Admin card-art overrides (sports cards & manual overrides)

The free card APIs cover Pokémon, Magic and Yu-Gi-Oh but **not sports cards**
(NBA, NFL, hockey…), so those rows fall back to a placeholder. The
`card_art_overrides` table (migration `20260719130000_create_card_art_overrides`)
lets an admin upload art for any card. The resolver checks it **first** — before
the free-API lookups — keyed by `cardArtLookupKey(name, set, collection)` (a
lowercased, whitespace-collapsed `name|set|collection`), so an override wins and
covers cards no API can.

- **Admin UI**: `/admin/card-art` (`pages/admin/CardArtManagementPage.jsx`) —
  enter the card's name/set/collection exactly as it appears in the movers table,
  upload an image. The image goes to the public `media` bucket (timestamped,
  `cacheControl: 31536000`), so it's served through this Worker and caches into
  R2 on first view like any other stored image — **no new bucket or credentials**.
- **Write path**: the page uploads the file client-side, then POSTs the metadata
  to `POST /admin/card-art` (admin-gated), which computes the lookup key
  server-side (the same function the resolver reads with, so keys can't drift)
  and upserts. `GET`/`DELETE /admin/card-art` list and remove.
- **Serving**: the resolver rewrites the stored Supabase URL onto `IMAGE_CDN_HOST`
  when set, so overrides ride the same CDN/R2 path. Overrides are cached in the
  resolver for 10 minutes (short, so a newly-added override shows up promptly and
  supersedes any already-cached API result). This is independent of
  `CARD_ART_CDN_HOST` above — overrides work whenever `IMAGE_CDN_HOST` is set (or
  even with no CDN at all, serving straight from Supabase).

**Bind the bucket — declare it in `wrangler.jsonc`, NOT the dashboard:**

The Worker is deployed by the Cloudflare Git integration, which runs Wrangler
against `wrangler.jsonc`. **Each deploy overwrites the Worker's bindings with
whatever that config lists.** So a binding added by hand in the dashboard
(Settings → Bindings) vanishes on the very next deploy — the classic "the
binding keeps disappearing". The binding must therefore live in the config:

1. Create the R2 bucket `cardpop-images` (R2 → Create bucket; APAC/Oceania
   location for AU proximity). *(Already done.)*
2. Declare the binding in `wrangler.jsonc` (already committed) so it deploys
   with the Worker and can't be wiped:
   ```jsonc
   "r2_buckets": [
     { "binding": "IMAGES", "bucket_name": "cardpop-images" }
   ]
   ```
   `binding` must stay `IMAGES` (the code reads `env.IMAGES`); `bucket_name` is
   the R2 bucket from step 1. Do **not** also add it in the dashboard — the
   config is authoritative and a dashboard entry just gets overwritten.
3. Deploy the Worker (push to the branch the Git integration builds from, or
   trigger a redeploy in the dashboard). The binding takes effect on that deploy.
4. Verify: `curl -sI https://img.cardpop.com.au/storage/v1/object/public/vault-images/<a-real-path>.jpeg`
   twice. The first request migrates the object into R2 (write-through, no
   `x-image-source` header yet); the second returns it from R2 with
   `x-image-source: r2`. A key not in R2 still returns the Supabase-served image.

**Backfill (optional pre-warm):** write-through already migrates each object the
first time it's viewed, so no backfill is strictly required — the bucket fills
itself as the site is used. To migrate everything up front (so even the first
visitor gets the free R2 copy), run `scripts/backfill-images-to-r2.mjs`. It lists
every object in the public buckets and requests each once through the CDN, which
drives the same write-through — so it needs **no R2 credentials**, only the
Supabase service-role key to list, and the Worker must already have the `IMAGES`
binding:

```
SUPABASE_URL=https://vrfsaazuqjxotnieqlkd.supabase.co \
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

1. CloudFront → Create distribution: origin `vrfsaazuqjxotnieqlkd.supabase.co`
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

## Pre-generated grid thumbnails

Card grids render at ~300 px but historically served the full 1600 px upload.
Since `THUMBNAILS_SINCE` (`utils/imageUrl.js`), every card image upload also
stores a small companion thumbnail (480 px longest edge, WebP q70) next to the
full image under a deterministic name: `<path minus ext>.thumb.webp`
(`thumbStoragePath`). No DB column is needed — upload filenames embed their
`Date.now()` timestamp, so `getCardImage` knows whether a thumb exists without
probing and only emits `thumbSrc` for uploads after the cutoff (legacy images
cost zero extra requests). `CardImage` tries `thumbSrc` first and falls back to
the full image; a dead thumb URL is remembered per session. Thumbs are
generated client-side (`createThumbnail` in `utils/compressImage.js`) and
server-side for the slab-template route (`createThumbnailBuffer` in
`src/utils/imageProcessor.js`), and are best-effort — a thumb failure never
fails the upload.

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
