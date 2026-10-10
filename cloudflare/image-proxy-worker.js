// Cloudflare Worker: image proxy for Supabase Storage, with an R2 fast path.
//
// Serves public storage images through img.cardpop.com.au so repeat traffic
// is absorbed by Cloudflare's edge cache instead of counting against the
// Supabase egress quota (Supabase meters ALL storage egress, including its
// own CDN's cache hits). Deployed in the Cloudflare dashboard — this file is
// the source of truth; see docs/image-cdn.md for setup.
//
// The URL path is passed through verbatim, so the app only swaps hostnames:
//   https://vrfsaazuqjxotnieqlkd.supabase.co/storage/v1/object/public/…
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

const ORIGIN = 'https://vrfsaazuqjxotnieqlkd.supabase.co';

// Only public storage objects (and the transform endpoint, should image
// transformations ever be enabled) — never the Auth/REST API, and never
// private buckets, which require signed URLs and must not be cached.
const OBJECT_PATH = /^\/storage\/v1\/object\/public\//;
const RENDER_PATH = /^\/storage\/v1\/render\/image\/public\//;

// ── Card-art passthrough (img.cardpop.com.au/card-art?src=<upstream>) ────────
//
// The card analytics/movers thumbnails resolve official art from free card
// APIs whose images live on their OWN CDNs. Hotlinking those CDNs is free but
// leaves us dependent on their uptime. This route lets us serve that art from
// our own edge/R2 instead: on first request the upstream image is fetched and
// written through to R2 (keyed by upstream host+path), so every later request
// is served from R2 — insulated from the upstream CDN and, like the Supabase
// fast path, at zero egress cost. Off by default: the app only emits /card-art
// URLs when CARD_ART_CDN_HOST is set server-side (see src/utils/
// cardImageResolver.js); until then this route is simply never hit.
const CARD_ART_PATH = /^\/card-art\/?$/;

// SSRF guard: the ONLY upstream hosts this route will fetch. Without a strict
// allowlist, `?src=` would turn the Worker into an open proxy for arbitrary
// URLs. Keep in sync with the allowlist in src/utils/cardImageResolver.js.
const CARD_ART_HOSTS = new Set([
  'images.pokemontcg.io', // Pokémon TCG API card art
  'cards.scryfall.io',    // Scryfall (Magic) card art
  'images.ygoprodeck.com',// YGOPRODeck (Yu-Gi-Oh) card art
]);

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

// Neutralise stored SVGs so a user-uploaded SVG in a public bucket can never
// execute script when served from our image subdomain. An SVG opened as a
// top-level document (direct navigation) or embedded via <iframe>/<object> can
// run embedded <script> / on* handlers — a stored-XSS vector. Forcing a
// download disposition plus a locked-down CSP sandbox stops that. Legitimate
// <img> embeds are unaffected: browsers render <img> regardless of
// Content-Disposition, and an SVG loaded through <img> is already non-scripting.
// decodeURIComponent throws URIError on malformed percent-encodings (e.g.
// `/…/public/%zz`), which `new URL()` leaves intact in the pathname. An uncaught
// throw here surfaces as a Cloudflare 1101 error page instead of a clean 404,
// so decode defensively and treat undecodable keys as "not found".
function safeDecode(str) {
  try {
    return decodeURIComponent(str);
  } catch {
    return null;
  }
}

function hardenIfSvg(headers) {
  const type = (headers.get('content-type') || '').toLowerCase();
  if (type.includes('svg')) {
    headers.set('Content-Disposition', 'attachment');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }
}

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

// ── Negative caching ──────────────────────────────────────────────────────
//
// A missing object costs more than a present one: an R2 read that misses, then
// a Supabase request that 404s — on every view, forever, because nothing
// remembered the miss. And misses are routine, not rare: grid thumbnails are
// *inferred* from the upload timestamp (utils/imageUrl.js) while the thumb
// upload itself is best-effort, so every card whose thumb never landed asks
// for a URL that will never exist, once per grid render per visitor.
//
// So a 404 from the origin is remembered at the edge for a few minutes: the
// `cf` fetch below caches the 404 itself, and for object paths a bodyless 404
// is also written under the query-free cache key that serveFromR2 checks
// FIRST, so a known-missing object skips the R2 read too. Short on purpose —
// an upload racing a request must become visible quickly — and 5xx is never
// cached: an origin outage should not outlive itself.
const NEGATIVE_TTL_SECONDS = 300;

// cacheTtlByStatus scopes the long TTL to 2xx only. A flat `cacheTtl` would
// cache a transient 5xx for a year, showing every visitor a broken image long
// after the origin recovered.
const CACHE_TTL_BY_STATUS = {
  '200-299': 31536000,
  '300-399': 0,
  '400-403': 0,
  '404': NEGATIVE_TTL_SECONDS,
  '405-599': 0,
};

// Canonical, query-free cache key (always GET) for an object path — collapses
// every query variant of this object onto one edge-cache entry.
const objectCacheKey = (url) => new Request(`${url.origin}${url.pathname}`, { method: 'GET' });

function rememberMissing(url, ctx) {
  if (!ctx || typeof ctx.waitUntil !== 'function') return;
  const headers = new Headers({
    'Cache-Control': `public, max-age=${NEGATIVE_TTL_SECONDS}`,
    'Access-Control-Allow-Origin': '*',
    'x-image-source': 'negative-cache',
  });
  ctx.waitUntil(
    caches.default.put(objectCacheKey(url), new Response('Not found', { status: 404, headers })).catch(() => {}),
  );
}

// Serve an object request from R2 if the object exists there, else return null
// so the caller can fall back to the Supabase proxy. Uses a query-stripped
// cache key so cache-busting query strings can't multiply edge entries or R2
// reads (object paths ignore the query entirely — see canonicalSearch).
async function serveFromR2(request, url, bucket, ctx) {
  const cache = caches.default;
  const cacheKey = objectCacheKey(url);

  // A hit here may be a remembered 404 (rememberMissing) — served as-is, so a
  // known-missing object costs neither an R2 read nor an origin request.
  const cached = await cache.match(cacheKey);
  if (cached) {
    // HEAD must not return a body, even on a cached GET response.
    return request.method === 'HEAD'
      ? new Response(null, { status: cached.status, headers: cached.headers })
      : cached;
  }

  const key = safeDecode(url.pathname.replace(OBJECT_PATH, ''));
  if (!key) return null;

  const object = await bucket.get(key);
  if (!object) return null; // not migrated → caller falls back to Supabase

  const headers = new Headers();
  object.writeHttpMetadata(headers); // content-type, etc. from the stored object
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*'); // service worker fetches in CORS mode
  headers.set('x-image-source', 'r2'); // observability: served from R2, zero egress
  hardenIfSvg(headers); // baked into the cached copy below

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

// Serve /card-art?src=<upstream> from R2 (or the upstream CDN on a miss, writing
// through to R2 so the next request is served locally). Mirrors the Supabase R2
// fast path: R2 hit → serve; miss → fetch upstream, stream to the client AND
// copy into R2 in the background. The R2 key ignores the upstream query string
// (a version cache-buster) — the path already identifies the image uniquely and
// the content is immutable — collapsing every variant onto one stored object.
async function serveCardArt(request, url, env, ctx) {
  const src = url.searchParams.get('src');
  if (!src) return new Response('Missing src', { status: 400 });

  let target;
  try {
    target = new URL(src);
  } catch {
    return new Response('Bad src', { status: 400 });
  }
  // Reject anything not on the allowlist so this can never be an open proxy.
  if (target.protocol !== 'https:' || !CARD_ART_HOSTS.has(target.host)) {
    return new Response('Host not allowed', { status: 403 });
  }

  const key = `card-art/${target.host}${target.pathname}`;
  const cache = caches.default;
  // Canonical, query-free edge-cache key so scryfall's ?<version> can't multiply
  // entries. Always GET (a HEAD reuses the cached GET response, bodyless).
  const cacheKey = new Request(`${url.origin}/card-art?k=${encodeURIComponent(key)}`, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) {
    return request.method === 'HEAD'
      ? new Response(null, { status: cached.status, headers: cached.headers })
      : cached;
  }

  // ── R2 fast path ──────────────────────────────────────────────────────────
  if (env && env.IMAGES) {
    const object = await env.IMAGES.get(key);
    if (object) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('x-image-source', 'r2-card-art');
      const cacheable = new Response(object.body, { headers });
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
      }
      return request.method === 'HEAD' ? new Response(null, { headers }) : cacheable;
    }
  }

  // ── Miss → fetch upstream (with the full src incl. query) ──────────────────
  const upstream = await fetch(target.toString(), {
    cf: { cacheEverything: true, cacheTtlByStatus: CACHE_TTL_BY_STATUS },
  });

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type') || '';
  if (contentType) headers.set('content-type', contentType);
  headers.set('Access-Control-Allow-Origin', '*');
  if (upstream.ok) headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  // Lazy write-through: split the stream so the client is served now while the
  // other half is copied into R2 in the background. Skipped for HEAD (no body),
  // non-2xx (never cache a miss/error), and when there's no binding/waitUntil.
  let clientBody = upstream.body;
  if (
    env && env.IMAGES &&
    ctx && typeof ctx.waitUntil === 'function' &&
    request.method === 'GET' &&
    upstream.ok &&
    upstream.body
  ) {
    const [toClient, toR2] = upstream.body.tee();
    clientBody = toClient;
    ctx.waitUntil(
      env.IMAGES.put(key, toR2, { httpMetadata: { contentType: contentType || undefined } }).catch(() => {})
    );
  }

  return request.method === 'HEAD'
    ? new Response(null, { status: upstream.status, headers })
    : new Response(clientBody, { status: upstream.status, statusText: upstream.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);

    // Card-art passthrough is a distinct namespace from Supabase storage paths.
    if (CARD_ART_PATH.test(url.pathname)) {
      return serveCardArt(request, url, env, ctx);
    }

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
    // a 2xx; a 404 is kept for a few minutes (see Negative caching above) and
    // nothing else is cached at all.
    const search = canonicalSearch(url.pathname, url.searchParams);
    const originResponse = await fetch(`${ORIGIN}${url.pathname}${search}`, {
      cf: { cacheEverything: true, cacheTtlByStatus: CACHE_TTL_BY_STATUS },
    });

    const headers = new Headers(originResponse.headers);
    // The app's service worker (public/sw.js) re-fetches images in CORS mode
    // so it can cache non-opaque responses — this header must survive.
    headers.set('Access-Control-Allow-Origin', '*');
    if (originResponse.ok) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (originResponse.status === 404) {
      // Tell the browser too, so a grid doesn't re-ask for the same missing
      // thumbnail on every render; and remember it ahead of the R2 read.
      headers.set('Cache-Control', `public, max-age=${NEGATIVE_TTL_SECONDS}`);
      if (isObject && request.method === 'GET') rememberMissing(url, ctx);
    }
    hardenIfSvg(headers);

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
      const key = safeDecode(url.pathname.replace(OBJECT_PATH, ''));
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
