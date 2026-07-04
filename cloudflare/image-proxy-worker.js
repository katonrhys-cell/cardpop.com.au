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
const ALLOWED_PATH = /^\/storage\/v1\/(object|render\/image)\/public\//;

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    if (!ALLOWED_PATH.test(url.pathname)) {
      return new Response('Not found', { status: 404 });
    }

    // cacheEverything + cacheTtl keeps successful responses at Cloudflare's
    // edge for a year regardless of the origin's Cache-Control (some older
    // uploads still carry max-age=3600). Uploads use immutable timestamped
    // filenames, so long TTLs can never serve stale content.
    const originResponse = await fetch(`${ORIGIN}${url.pathname}${url.search}`, {
      cf: { cacheEverything: true, cacheTtl: 31536000 },
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
