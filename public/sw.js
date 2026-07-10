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
  STATIC: 'cardpop-static-v5',
  DYNAMIC: 'cardpop-dynamic-v5',
  PAGES: 'cardpop-pages-v5',
  IMAGES: 'cardpop-images-v1',
};

// Cap the image cache so it can't grow without bound (entries are evicted
// oldest-first). Card photos average ~100-300 KB, so this is roughly 100 MB.
const MAX_IMAGE_ENTRIES = 500;

// Only precache the app shell. Vite emits content-hashed asset filenames
// (assets/*.js|css) that aren't known at SW-author time, and the previous list
// included dev-only paths (/index.css, /global.css, /main.jsx) that 404 in
// production — because cache.addAll is atomic, one 404 made the ENTIRE precache
// (including '/') silently fail. Hashed assets are cached on demand (cacheFirst).
const STATIC_ASSETS = [
  '/',
  '/index.html',
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
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache successful responses
      const cache = await caches.open(CACHE_NAMES.DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
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
};

// Helper: Cache First strategy
const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background
    fetch(request).then((response) => {
      if (response.ok) {
        const cache = caches.open(CACHE_NAMES.STATIC);
        cache.then((c) => c.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAMES.STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
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
const SUPABASE_ORIGIN = 'https://odoglvswwymyjuwlonkf.supabase.co';

// Map a storage image served through the image CDN (any non-Supabase host) back
// to the canonical Supabase origin, keeping the /storage/v1/... path intact.
// Returns null when the URL is already canonical (nothing to fall back to).
// Mirrors canonicalStorageUrl() in utils/imageCdnFallback.js so a CDN outage
// self-heals at the service-worker layer too.
const canonicalStorageUrl = (url) =>
  url.origin === SUPABASE_ORIGIN ? null : `${SUPABASE_ORIGIN}${url.pathname}${url.search}`;

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

  try {
    // <img> tags issue no-cors requests, whose opaque responses can't be
    // inspected and are stored with a large quota padding. Storage serves
    // `Access-Control-Allow-Origin: *`, so re-issue as a CORS request to get
    // a normal, cacheable response.
    const response = await fetch(request.url, { mode: 'cors' });
    if (response.ok) {
      await cache.put(request.url, response.clone());
      trimCache(CACHE_NAMES.IMAGES, MAX_IMAGE_ENTRIES).catch(() => {});
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
      cache.put(request, response.clone());
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
  // (odoglvswwymyjuwlonkf.supabase.co/rest/v1/…, /auth/v1/…) — must go
  // straight to the network. Their extension-less paths used to fall into the
  // stale-while-revalidate branch below, which (a) served DB query results
  // from cache first, so the homepage showed stale or empty featured
  // cards/sellers no matter what the database returned, and (b) matched
  // cached responses while ignoring the Authorization header, blurring
  // logged-in/logged-out state.
  if (url.origin !== self.location.origin) return;

  // Network First for API calls
  if (pathname.startsWith('/api') || pathname.startsWith('/hcgi/api')) {
    event.respondWith(networkFirst(request));
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
