// Cloudflare Worker: image proxy for Supabase Storage, with an R2 fast path.
//
// Serves public storage images through img.cardpop.com.au so repeat traffic
// is absorbed by Cloudflare's edge cache instead of counting against the
// Supabase egress quota (Supabase meters ALL storage egress, including its
// own CDN's cache hits). Deployed in the Cloudflare dashboard — this file is
// the source of truth; see docs/image-cdn.md for setup.
//
// The URL path is passed through verbatim, so the app only swaps hostnames:
//   https://odoglvswwymyjuwlonkf.supabase.co/storage/v1/object/public/…
//   → https://img.cardpop.com.au/storage/v1/object/public/…
//
// R2 fast path: when the `IMAGES` R2 binding is present, an /object/public/
// request first looks for the object in R2, keyed by the same "<bucket>/<path>"
// suffix the public URL already carries (so no URL rewrite is needed). A hit is
// served straight from R2 — bytes never leave Cloudflare, so zero Supabase
// egress; a miss falls through to the Supabase proxy below. Objects can
// therefore be migrated into R2 one at a time with no frontend change and full
// reversibility (delete from R2 → requests fall back to Supabase again).
// Transform requests (/render/image/public/) are never served from R2 — R2
// can't resize — so they always proxy to Supabase.

const ORIGIN = 'https://odoglvswwymyjuwlonkf.supabase.co';

// Only public storage objects (and the transform endpoint, should image
// transformations ever be enabled) — never the Auth/REST API, and never
// private buckets, which require signed URLs and must not be cached.
const OBJECT_PATH = /^\/storage\/v1\/object\/public\//;
const RENDER_PATH = /^\/storage\/v1\/render\/image\/public\//;

// ── Query-string canonicalisation ─────────────────────────────────────────
//
// The edge cache keys on the full URL, so every distinct query string is a
// distinct cache entry that misses through to Supabase (metered egress).
// Left unchecked, `?cachebust=<random>` turns the cache into a passthrough —
// an attacker (or an over-eager cache-busting param in old HTML) can replay
// one image thousands of times at full origin cost. Canonicalising the query
// collapses all variants of a request onto one cache key:
//
//  - /object/ paths: Supabase ignores query params entirely → strip them all.
//  - /render/image/ paths: only real transform params are kept, numeric
//    values are snapped to a small ladder, and keys are sorted — bounding the
//    number of purchasable transform permutations per image to a handful.

// Supabase image-transform params (https://supabase.com/docs/guides/storage/serving/image-transformations).
const WIDTH_LADDER = [160, 240, 320, 480, 640, 800, 1200, 1600, 2000, 2560];
const QUALITY_LADDER = [50, 75, 90];
const RESIZE_MODES = new Set(['cover', 'contain', 'fill']);

function snapUp(value, ladder) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return ladder.find((step) => n <= step) ?? ladder[ladder.length - 1];
}

export function canonicalSearch(pathname, searchParams) {
  if (!RENDER_PATH.test(pathname)) return ''; // object paths: no query at all

  const out = new URLSearchParams();
  const width = snapUp(searchParams.get('width'), WIDTH_LADDER);
  const height = snapUp(searchParams.get('height'), WIDTH_LADDER);
  const quality = snapUp(searchParams.get('quality'), QUALITY_LADDER);
  const resize = searchParams.get('resize');
  if (width) out.set('width', String(width));
  if (height) out.set('height', String(height));
  if (quality) out.set('quality', String(quality));
  if (resize && RESIZE_MODES.has(resize)) out.set('resize', resize);
  if (searchParams.get('format') === 'origin') out.set('format', 'origin');

  out.sort();
  const s = out.toString();
  return s ? `?${s}` : '';
}

// Serve an object request from R2 if the object exists there, else return null
// so the caller can fall back to the Supabase proxy. Uses a query-stripped
// cache key so cache-busting query strings can't multiply edge entries or R2
// reads (object paths ignore the query entirely — see canonicalSearch).
async function serveFromR2(request, url, bucket, ctx) {
  const cache = caches.default;
  // Canonical, query-free cache key (always GET) — collapses every query
  // variant of this object onto one edge-cache entry.
  const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) {
    // HEAD must not return a body, even on a cached GET response.
    return request.method === 'HEAD'
      ? new Response(null, { status: cached.status, headers: cached.headers })
      : cached;
  }

  const key = decodeURIComponent(url.pathname.replace(OBJECT_PATH, ''));
  if (!key) return null;

  const object = await bucket.get(key);
  if (!object) return null; // not migrated → caller falls back to Supabase

  const headers = new Headers();
  object.writeHttpMetadata(headers); // content-type, etc. from the stored object
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*'); // service worker fetches in CORS mode

  // Cache the full GET response at the edge, then hand the caller a body-correct
  // response for the actual method.
  const cacheable = new Response(object.body, { headers });
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
  }
  return request.method === 'HEAD'
    ? new Response(null, { headers })
    : cacheable;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const isObject = OBJECT_PATH.test(url.pathname);
    if (!isObject && !RENDER_PATH.test(url.pathname)) {
      return new Response('Not found', { status: 404 });
    }

    // ── R2 fast path (object requests only) ───────────────────────────────
    // Serve migrated objects straight from R2 (free egress). The R2 key is the
    // path after /storage/v1/object/public/ — the same "<bucket>/<path>" the
    // public URL uses — so no rewrite is needed. A miss falls through to the
    // Supabase proxy below, keeping migration transparent and reversible. The
    // binding is optional: with no `IMAGES` binding this whole block is skipped
    // and the Worker behaves exactly as the Supabase-only proxy did.
    if (isObject && env && env.IMAGES) {
      const r2 = await serveFromR2(request, url, env.IMAGES, ctx);
      if (r2) return r2;
    }

    // cacheEverything + cacheTtlByStatus keeps successful responses at
    // Cloudflare's edge for a year regardless of the origin's Cache-Control
    // (some older uploads still carry max-age=3600). Uploads use immutable
    // timestamped filenames, so long TTLs can never serve stale content for
    // a 2xx. But a flat `cacheTtl` applies to EVERY status, including a
    // transient 404/5xx (a deleted object, a race with an in-flight upload,
    // an origin outage) — that would cache the error at the edge for a full
    // year, showing every visitor a broken image long after the origin
    // recovered. cacheTtlByStatus scopes the long TTL to 2xx only.
    const search = canonicalSearch(url.pathname, url.searchParams);
    const originResponse = await fetch(`${ORIGIN}${url.pathname}${search}`, {
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: { '200-299': 31536000, '300-399': 0, '400-599': 0 },
      },
    });

    const headers = new Headers(originResponse.headers);
    // The app's service worker (public/sw.js) re-fetches images in CORS mode
    // so it can cache non-opaque responses — this header must survive.
    headers.set('Access-Control-Allow-Origin', '*');
    if (originResponse.ok) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    // ── Lazy write-through migration into R2 ──────────────────────────────
    // The first successful proxy of an object copies its bytes into R2, so
    // every later request is served from the R2 fast path above (free egress)
    // instead of re-hitting Supabase. tee() splits the stream: one half streams
    // to the client now, the other is written to R2 in the background via
    // ctx.waitUntil. Net cost is one Supabase read per object, once — and only
    // for objects actually viewed. Skipped for HEAD (no body), non-2xx (never
    // migrate a miss/error), and when there's no binding or waitUntil.
    let clientBody = originResponse.body;
    if (
      isObject &&
      env && env.IMAGES &&
      ctx && typeof ctx.waitUntil === 'function' &&
      request.method === 'GET' &&
      originResponse.ok &&
      originResponse.body
    ) {
      const key = decodeURIComponent(url.pathname.replace(OBJECT_PATH, ''));
      if (key) {
        const [toClient, toR2] = originResponse.body.tee();
        clientBody = toClient;
        const httpMetadata = {
          contentType: originResponse.headers.get('content-type') || undefined,
        };
        // Never let a failed migration break the response the user is getting.
        ctx.waitUntil(env.IMAGES.put(key, toR2, { httpMetadata }).catch(() => {}));
      }
    }

    return new Response(clientBody, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    });
  },
};
