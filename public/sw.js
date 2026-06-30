// Service Worker for offline support and intelligent caching strategies
// - Network First for API requests (try network, fallback to cache)
// - Cache First for static assets (serve from cache, update in background)
// - Stale While Revalidate for HTML pages (serve cached, update in background)

const CACHE_NAMES = {
  STATIC: 'cardpop-static-v3',
  DYNAMIC: 'cardpop-dynamic-v3',
  PAGES: 'cardpop-pages-v3',
};

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

// Helper: Stale While Revalidate strategy
const staleWhileRevalidate = async (request) => {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(CACHE_NAMES.PAGES);
      cache.then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => {
    // Network failed, return cached if available
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  });

  return cached || fetchPromise;
};

// Fetch: route requests to appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const { pathname } = new URL(request.url);

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

  // Stale While Revalidate for HTML pages
  if (request.mode === 'navigate' || pathname.endsWith('.html') || !pathname.includes('.')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: Network First
  event.respondWith(networkFirst(request));
});
