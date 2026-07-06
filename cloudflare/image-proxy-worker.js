// Cloudflare Worker: image proxy for Supabase Storage.
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

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    if (!OBJECT_PATH.test(url.pathname) && !RENDER_PATH.test(url.pathname)) {
      return new Response('Not found', { status: 404 });
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

    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    });
  },
};
