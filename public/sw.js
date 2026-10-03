// Service Worker for offline support and intelligent caching strategies
// - Network First for API requests (try network, fallback to cache)
// - Network First for navigations / HTML (see navigationNetworkFirst below)
// - Cache First for static assets (serve from cache, update in background)

const CACHE_NAMES = {
  // v5: navigations/HTML moved from stale-while-revalidate to network-first.
  // The old SWR branch served a CACHED (stale) app shell to returning visitors,
  // so after a deploy their shell still referenced the PREVIOUS build's
  // content-hashed lazy-chunk filenames. Those chunks no longer exist on the
  // server, so importing a route like /marketplace fetched a dead hash and got
  // the SPA's app.html fallback (Content-Type: text/html) back — the dynamic
  // import then failed ("'text/html' is not a valid JavaScript MIME type" /
  // "Importing a module script failed") and the page never loaded. Fresh /
  // incognito visitors (no cached shell) were unaffected, which made it look
  // like a logged-in-only bug. Booting the shell network-first fixes it; the
  // bumped suffix evicts the stale PAGES entries via the activate handler.
  // STATIC v6: evicts the v5 cache, which on affected devices held the ~11 MB
  // OpenCV chunk. That single entry could exhaust the origin's Cache Storage
  // quota, and the old cacheFirst turned the resulting cache.put rejection into
  // a fabricated 503 — so every uncached /assets/ file failed to load until the
  // origin's storage was cleared by hand. Dropping the cache reclaims the space
  // on the first navigation after this deploy.
  // STATIC v7: a missing /images/ or /assets/ file used to come back as the
  // SPA's app.html with a 200, and cacheFirst stored that HTML under the
  // image's URL — so a product photo requested in the moment between a
  // migration pointing at it and the deploy shipping it stayed broken on that
  // device forever. cacheStatic now refuses HTML; the bump evicts copies
  // already stored.
  STATIC: 'cardpop-static-v7',
  DYNAMIC: 'cardpop-dynamic-v5',
  PAGES: 'cardpop-pages-v5',
  IMAGES: 'cardpop-images-v1',
};

// Cap the image cache so it can't grow without bound (entries are evicted
// oldest-first). Card photos average ~100-300 KB, so this is roughly 100 MB.
const MAX_IMAGE_ENTRIES = 500;

// Cap the other caches too. STATIC accumulates each deploy's content-hashed
// JS/CSS (old hashes are never requested again but were never evicted between
// version bumps), and DYNAMIC stores every same-origin API GET — both grew
// the origin's storage quota forever on returning visitors' devices.
const MAX_STATIC_ENTRIES = 150;
const MAX_DYNAMIC_ENTRIES = 50;

// Only precache the app shell. Vite emits content-hashed asset filenames
// (assets/*.js|css) that aren't known at SW-author time, and the previous list
// included dev-only paths (/index.css, /global.css, /main.jsx) that 404 in
// production — because cache.addAll is atomic, one 404 made the ENTIRE precache
// (including '/') silently fail. Hashed assets are cached on demand (cacheFirst).
const STATIC_ASSETS = [
  '/',
  '/index.html',
  // Stable (unhashed) path. Precaching the heading font guarantees repeat
  // visits paint Syne on the first frame even if the HTTP cache was evicted.
  '/fonts/syne-latin-var.woff2',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAMES.STATIC).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignore errors if assets aren't available yet
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!Object.values(CACHE_NAMES).includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Network First strategy
const networkFirst = async (request) => {
  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Network failed, serving from cache:', request.url);
      return cached;
    }
    // Return offline response for API errors
    return new Response(
      JSON.stringify({ error: 'Offline', code: 'OFFLINE' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Caching is best-effort and happens only after the network has answered, so
  // a full-quota cache.put can never demote a fresh 200 to a stale entry or a
  // fabricated offline error (see cacheStatic).
  if (response.ok) {
    try {
      const cache = await caches.open(CACHE_NAMES.DYNAMIC);
      await cache.put(request, response.clone());
      await trimCache(CACHE_NAMES.DYNAMIC, MAX_DYNAMIC_ENTRIES);
    } catch {
      // Quota exhausted — the fresh response is still returned below.
    }
  }
  return response;
};

// Helper: Network Only strategy — for authenticated, per-user API responses.
// These carry a Bearer token the Cache API ignores on match and are marked
// no-store by the server, so they must never be written to Cache Storage (they
// would persist after logout and, on a flaky network, be served to a different
// user from the same device). No cache read on failure either — just a clean
// offline response.
const networkOnly = async (request) => {
  try {
    return await fetch(request);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Offline', code: 'OFFLINE' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Largest response the STATIC cache will store. The OpenCV.js build behind the
// card auto-crop is a single ~11 MB chunk — storing it is what pushed the
// origin over its Cache Storage quota (Safari's is small, and the image cache
// already holds up to MAX_IMAGE_ENTRIES photos beside it). It is loaded once
// per session on demand, so the HTTP cache is a good enough home for it;
// keeping it out of Cache Storage leaves room for the chunks that do benefit.
const MAX_STATIC_ENTRY_BYTES = 6 * 1024 * 1024;

// Whether this response is small enough to be worth storing. An absent or
// unparseable Content-Length is treated as cacheable — the write is best-effort
// either way (see cacheStatic).
const isCacheableSize = (response) => {
  const len = Number(response.headers.get('Content-Length'));
  return !Number.isFinite(len) || len <= MAX_STATIC_ENTRY_BYTES;
};

// Write to the STATIC cache, best-effort. Storing a response is an
// optimisation, never a precondition for serving it: cache.put rejects with
// QuotaExceededError once the origin's storage is full, and letting that
// rejection escape used to turn an already-fetched 200 into a fabricated 503
// "Offline". That bricked whatever the failed asset provided — for the ~11 MB
// OpenCV chunk it silently killed card auto-crop (auto-detect, the live crop
// preview and Apply all failed together) on a perfectly good connection.
const cacheStatic = async (request, response) => {
  if (!isCacheableSize(response)) return;
  // A static asset is never HTML. An HTML 200 here is the SPA fallback
  // standing in for a file that doesn't exist (yet) — serve it, but never
  // pin it under the asset's URL.
  if ((response.headers.get('Content-Type') || '').includes('text/html')) return;
  try {
    const cache = await caches.open(CACHE_NAMES.STATIC);
    await cache.put(request, response);
    await trimCache(CACHE_NAMES.STATIC, MAX_STATIC_ENTRIES);
  } catch {
    // Quota exhausted or the entry is too large — serving still works.
  }
};

// Helper: Cache First strategy
const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background
    fetch(request)
      .then((response) => {
        if (response.ok) return cacheStatic(request, response);
        return undefined;
      })
      .catch(() => {});
    return cached;
  }

  let response;
  try {
    response = await fetch(request);
  } catch {
    // Only a genuine network failure is an offline response.
    return new Response('Offline', { status: 503 });
  }

  if (response.ok) await cacheStatic(request, response.clone());
  return response;
};

// Helper: Cache First for storage-hosted images (Supabase Storage or the
// image CDN in front of it). Supabase meters ALL storage egress — even CDN
// cache hits — against the plan's quota, so re-downloading unchanged card
// photos on every visit is what blows the free tier's egress limit. Uploaded
// images are immutable (timestamped filenames), so once fetched they can be
// served from the local cache indefinitely.
const isStorageImage = (url) =>
  /\/storage\/v1\/(object|render\/image)\/public\//.test(url.pathname);

// Canonical Supabase Storage origin — the source of truth every storage object
// is always readable from. Hardcoded like the project URL elsewhere
// (lib/supabaseClient.js) and the worker's ORIGIN (cloudflare/image-proxy-worker.js).
const SUPABASE_ORIGIN = 'https://vrfsaazuqjxotnieqlkd.supabase.co';

// Map a storage image served through the image CDN (any non-Supabase host) back
// to the canonical Supabase origin, keeping the /storage/v1/... path intact.
// Returns null when the URL is already canonical (nothing to fall back to).
// Mirrors canonicalStorageUrl() in utils/imageCdnFallback.js so a CDN outage
// self-heals at the service-worker layer too.
const canonicalStorageUrl = (url) =>
  url.origin === SUPABASE_ORIGIN ? null : `${SUPABASE_ORIGIN}${url.pathname}${url.search}`;

// Image CDN origin, passed by main.jsx as ?cdn=<host> on the registration URL
// (this file is static, so build-time env vars can't be inlined here). When
// set, storage images requested from the canonical Supabase origin are
// fetched via the CDN instead — the catch-all for raw DB-stored URLs
// (article-body <img> tags, admin-entered URLs) that no render-time helper
// reaches. Supabase meters all storage egress; the CDN doesn't.
const CDN_ORIGIN = (() => {
  try {
    const host = new URL(self.location.href).searchParams.get('cdn');
    if (!host) return null;
    const trimmed = host.trim().replace(/\/+$/, '');
    if (!trimmed) return null;
    return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  } catch {
    return null;
  }
})();

// Canonical Supabase storage URL → its CDN equivalent, or null when no CDN is
// configured or the request is already on the CDN host.
const cdnStorageUrl = (url) =>
  CDN_ORIGIN && url.origin === SUPABASE_ORIGIN
    ? `${CDN_ORIGIN}${url.pathname}${url.search}`
    : null;

const trimCache = async (cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // cache.keys() returns entries in insertion order — delete oldest first.
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
};

const imageCacheFirst = async (request) => {
  const cache = await caches.open(CACHE_NAMES.IMAGES);
  const cached = await cache.match(request.url);
  if (cached) return cached;

  // Prefer the CDN even when the markup referenced the canonical Supabase URL.
  // The response is cached under the ORIGINAL request URL, so later lookups hit
  // no matter which host the markup used.
  const cdnUrl = cdnStorageUrl(new URL(request.url));

  try {
    // <img> tags issue no-cors requests, whose opaque responses can't be
    // inspected and are stored with a large quota padding. Storage serves
    // `Access-Control-Allow-Origin: *`, so re-issue as a CORS request to get
    // a normal, cacheable response.
    const response = await fetch(cdnUrl || request.url, { mode: 'cors' });
    if (response.ok) {
      await cache.put(request.url, response.clone());
      trimCache(CACHE_NAMES.IMAGES, MAX_IMAGE_ENTRIES).catch(() => {});
    } else if (cdnUrl) {
      // The CDN answered with an error (misroute, worker misconfig). The
      // object may still exist at the canonical origin — retry there rather
      // than surfacing a broken image.
      const originResponse = await fetch(request.url, { mode: 'cors' });
      if (originResponse.ok) {
        await cache.put(request.url, originResponse.clone());
        trimCache(CACHE_NAMES.IMAGES, MAX_IMAGE_ENTRIES).catch(() => {});
        return originResponse;
      }
      return response;
    }
    return response;
  } catch (error) {
    // The fetch failed at the network level — most often the image CDN host
    // is down/misconfigured. If this object was served through the CDN, retry
    // against the canonical Supabase origin (always readable) and cache the
    // result under the original CDN key so later hits skip the dead host. This
    // self-heals a CDN outage here instead of rejecting respondWith (which the
    // browser surfaces as "FetchEvent.respondWith received an error" + a broken
    // <img>). The DOM-level net in utils/imageCdnFallback.js is the same idea a
    // layer up; doing it here also keeps the image cached.
    const canonical = canonicalStorageUrl(new URL(request.url));
    if (canonical) {
      try {
        const originResponse = await fetch(canonical, { mode: 'cors' });
        if (originResponse.ok) {
          await cache.put(request.url, originResponse.clone());
          trimCache(CACHE_NAMES.IMAGES, MAX_IMAGE_ENTRIES).catch(() => {});
        }
        return originResponse;
      } catch {
        // Origin unreachable too (genuinely offline) — fall through.
      }
    }
    // Last resort: the untouched original request (offline, or an origin
    // without CORS — an opaque response is still paintable in an <img>).
    return fetch(request);
  }
};

// Helper: Network First for navigations / HTML app shell.
//
// The shell MUST come from the network so a returning visitor always boots the
// CURRENT build — its content-hashed lazy-chunk references then match the files
// still on the server. Serving a cached (stale) shell is what made returning
// users request deleted chunk hashes and hit the SPA's text/html fallback,
// breaking lazy routes like /marketplace. The cache is a pure offline fallback
// here, never the primary source.
const navigationNetworkFirst = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAMES.PAGES);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    // Offline: fall back to the cached navigation, then any cached app shell.
    const cached =
      (await caches.match(request)) ||
      (await caches.match('/app.html')) ||
      (await caches.match('/index.html')) ||
      (await caches.match('/'));
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
};

// Fetch: route requests to appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const { pathname } = url;

  // Never intercept mutations — caching a POST/PATCH response is a spec
  // violation (cache.put throws) and there is nothing useful to cache.
  if (request.method !== 'GET') return;

  // Cache First for storage-hosted images (card photos, avatars, media).
  // These previously fell through to Network First, which re-downloaded every
  // image on every page view and burned through the Supabase egress quota.
  if (isStorageImage(url)) {
    event.respondWith(imageCacheFirst(request));
    return;
  }

  // Any other cross-origin request — above all Supabase REST/Auth calls
  // (vrfsaazuqjxotnieqlkd.supabase.co/rest/v1/…, /auth/v1/…) — must go
  // straight to the network. Their extension-less paths used to fall into the
  // stale-while-revalidate branch below, which (a) served DB query results
  // from cache first, so the homepage showed stale or empty featured
  // cards/sellers no matter what the database returned, and (b) matched
  // cached responses while ignoring the Authorization header, blurring
  // logged-in/logged-out state.
  if (url.origin !== self.location.origin) return;

  // Network Only for API calls — never cache per-user, no-store API responses
  // (caching them leaked one user's data to the next on a shared device).
  if (pathname.startsWith('/api') || pathname.startsWith('/hcgi/api')) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Cache First for static assets
  if (
    pathname.match(/\.(js|css|woff2|png|jpg|jpeg|svg|ico)$/) ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/images/')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network First for navigations / HTML pages so the app shell is always the
  // current build (stale shells reference deleted chunk hashes — see above).
  if (request.mode === 'navigate' || pathname.endsWith('.html') || !pathname.includes('.')) {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  // Default: Network First
  event.respondWith(networkFirst(request));
});

// ── Web Push ─────────────────────────────────────────────────────────────────
// Payloads are JSON written by src/utils/pushService.js:
//   { title, body, url, tag }
// A malformed or empty payload still shows a generic notification — a push
// the user granted permission for should never be silently dropped.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'CardPop';
  const options = {
    body: payload.body || 'You have a new notification.',
    icon: '/favicon-192.png',
    badge: '/favicon-192.png',
    // Same-type notifications collapse instead of stacking endlessly.
    tag: payload.tag || 'cardpop',
    data: { url: payload.url || '/account/notifications' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  // Focus an open CardPop tab if there is one, otherwise open a new one.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
