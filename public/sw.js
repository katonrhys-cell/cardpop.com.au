/**
 * CardPop Service Worker
 * Provides offline support, network caching, and performance optimization
 *
 * Caching Strategy:
 * - Network First (API): Try network, fallback to cache for offline
 * - Cache First (Assets): Use cache, fetch updates in background
 * - Stale While Revalidate (HTML): Serve cached immediately, update in background
 */

const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  // Long-lived cache for static assets
  STATIC: `cardpop-static-${CACHE_VERSION}`,
  // Dynamic cache for API responses
  DYNAMIC: `cardpop-dynamic-${CACHE_VERSION}`,
  // HTML pages for offline support
  PAGES: `cardpop-pages-${CACHE_VERSION}`,
};

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
];

// ─────────────────────────────────────────────────────────────────────────
// Install Event: Cache static assets
// ─────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAMES.STATIC).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some static assets failed to cache:', err);
        // Don't fail install if some assets can't be cached
      });
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// ─────────────────────────────────────────────────────────────────────────
// Activate Event: Clean up old caches
// ─────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
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
    })
  );
  self.clients.claim();
});

// ─────────────────────────────────────────────────────────────────────────
// Fetch Event: Implement caching strategies
// ─────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests (Google Analytics, etc)
  if (!url.origin.includes(self.location.origin)) {
    // For external scripts, use network-only
    event.respondWith(fetch(request).catch(() => new Response('Offline')));
    return;
  }

  // API requests: Network first, fallback to cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/hcgi/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // HTML pages: Stale while revalidate
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.PAGES));
    return;
  }

  // Static assets (JS, CSS, images): Cache first
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.match(/\.(js|css|woff2|ttf|eot|svg)$/)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: Network first
  event.respondWith(networkFirst(request));
});

// ─────────────────────────────────────────────────────────────────────────
// Cache Strategies
// ─────────────────────────────────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAMES.DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline - Request failed', { status: 503 });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background (don't wait)
    fetch(request).then((response) => {
      if (response.ok) {
        const cache = caches.open(CACHE_NAMES.STATIC);
        cache.then((c) => c.put(request, response.clone()));
      }
    }).catch(() => {
      // Background update failed, but we served from cache so it's fine
    });
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAMES.STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline - Asset not cached', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  // Fetch in background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cache = caches.open(cacheName);
        cache.then((c) => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => cached || new Response('Offline', { status: 503 }));

  // Return cached immediately if available, otherwise wait for network
  return cached || fetchPromise;
}

// ─────────────────────────────────────────────────────────────────────────
// Background Sync: Retry failed requests when back online
// ─────────────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
