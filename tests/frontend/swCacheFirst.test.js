import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SW_SRC = readFileSync(resolve(root, 'public/sw.js'), 'utf8');

const quotaExceeded = async () => {
  const err = new Error('Quota exceeded.');
  err.name = 'QuotaExceededError';
  throw err;
};

const okResponse = (body = '/* the real asset */', bytes = 204800) =>
  new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/javascript', 'Content-Length': String(bytes) },
  });

// public/sw.js is a service-worker script (top-level `self.addEventListener`),
// so it can't be imported. Evaluate its source with the worker globals stubbed
// and hand back the strategy helpers to exercise directly.
const loadServiceWorker = ({
  put = async () => {},
  match = async () => undefined,
  fetchImpl = async () => okResponse(),
} = {}) => {
  const stored = [];
  const cache = {
    put: async (request, response) => {
      await put(request, response);
      stored.push(request.url ?? String(request));
    },
    match,
    keys: async () => [],
    delete: async () => true,
  };

  const factory = new Function(
    'self', 'caches', 'fetch', 'console',
    `${SW_SRC}\nreturn { cacheFirst, networkFirst, MAX_STATIC_ENTRY_BYTES };`,
  );

  const api = factory(
    {
      addEventListener: () => {},
      skipWaiting: () => {},
      clients: { claim: () => {}, matchAll: async () => [] },
      registration: { showNotification: () => {} },
      location: { origin: 'https://cardpop.com.au' },
    },
    { open: async () => cache, match, keys: async () => [], delete: async () => true },
    fetchImpl,
    { log: () => {}, error: () => {} },
  );

  return { ...api, stored };
};

const assetRequest = () => new Request('https://cardpop.com.au/assets/opencv-BarwkdDu.js');

describe('service worker cacheFirst', () => {
  it('serves the fetched asset and stores it when the cache write succeeds', async () => {
    const { cacheFirst, stored } = loadServiceWorker();
    const res = await cacheFirst(assetRequest());

    expect(res.status).toBe(200);
    expect(stored).toHaveLength(1);
  });

  // Regression: a full Cache Storage quota rejected cache.put inside the try
  // that also wrapped fetch, so an already-fetched 200 was discarded and a
  // fabricated 503 "Offline" returned instead. For the ~11 MB OpenCV chunk that
  // silently killed card auto-crop — auto-detect, the live crop preview and
  // "Apply crop" all failed together on a perfectly good connection.
  it('still serves the asset when the cache is over quota', async () => {
    const { cacheFirst, stored } = loadServiceWorker({ put: quotaExceeded });
    const res = await cacheFirst(assetRequest());

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('/* the real asset */');
    expect(stored).toHaveLength(0);
  });

  it('serves but does not store a response larger than the static entry cap', async () => {
    const { MAX_STATIC_ENTRY_BYTES } = loadServiceWorker();
    const { cacheFirst, stored } = loadServiceWorker({
      fetchImpl: async () => okResponse('/* 11 MB of OpenCV */', MAX_STATIC_ENTRY_BYTES + 1),
    });

    const res = await cacheFirst(assetRequest());

    expect(res.status).toBe(200);
    expect(stored).toHaveLength(0);
  });

  // Regression: a product photo requested before the deploy that ships it got
  // the SPA's app.html back as a 200, which was stored under the image URL and
  // served as a broken image from then on.
  it('serves but does not store the HTML app shell standing in for a missing file', async () => {
    const { cacheFirst, stored } = loadServiceWorker({
      fetchImpl: async () => new Response('<!doctype html><div id="root"></div>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    });

    const res = await cacheFirst(new Request('https://cardpop.com.au/images/shop/new-product_front.jpg'));

    expect(res.status).toBe(200);
    expect(stored).toHaveLength(0);
  });

  it('returns an offline response only when the network itself fails', async () => {
    const { cacheFirst } = loadServiceWorker({
      fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
    });

    expect((await cacheFirst(assetRequest())).status).toBe(503);
  });
});

describe('service worker networkFirst', () => {
  // Regression: the same quota rejection used to fall into the offline branch,
  // serving a STALE cached body (or a 503) in place of the fresh 200.
  it('returns the fresh response even when the cache is over quota', async () => {
    const { networkFirst } = loadServiceWorker({
      put: quotaExceeded,
      match: async () => new Response('stale', { status: 200 }),
    });

    const res = await networkFirst(new Request('https://cardpop.com.au/data.json'));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('/* the real asset */');
  });
});
