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
  keys = async () => [],
} = {}) => {
  const stored = [];
  const deleted = [];
  const cache = {
    put: async (request, response) => {
      await put(request, response);
      stored.push(request.url ?? String(request));
    },
    match,
    keys,
    delete: async (request) => { deleted.push(request.url ?? String(request)); return true; },
  };

  const factory = new Function(
    'self', 'caches', 'fetch', 'console',
    `${SW_SRC}\nreturn { cacheFirst, networkFirst, MAX_STATIC_ENTRY_BYTES, isStorageImage, isStorageVideo, isRangeRequest, purgeCachedVideos };`,
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

  return { ...api, stored, deleted };
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

  // Content-hashed chunks are immutable: a new build has new filenames, so
  // re-fetching a cached chunk on every hit only doubled the JS transferred.
  it('serves a cached content-hashed chunk without re-fetching it', async () => {
    let fetches = 0;
    const { cacheFirst } = loadServiceWorker({
      match: async () => okResponse('/* cached */'),
      fetchImpl: async () => { fetches += 1; return okResponse(); },
    });

    const res = await cacheFirst(assetRequest());
    await new Promise((r) => setTimeout(r, 0));

    expect(await res.text()).toBe('/* cached */');
    expect(fetches).toBe(0);
  });

  it('still revalidates an unhashed file in the background', async () => {
    let fetches = 0;
    const { cacheFirst } = loadServiceWorker({
      match: async () => okResponse('/* cached */'),
      fetchImpl: async () => { fetches += 1; return okResponse(); },
    });

    const res = await cacheFirst(new Request('https://cardpop.com.au/images/shop/binder_front.jpg'));
    await new Promise((r) => setTimeout(r, 0));

    expect(await res.text()).toBe('/* cached */');
    expect(fetches).toBe(1);
  });
});

// Card clips share the public bucket with the photos but must never be treated
// as images: <video> needs Range responses (Safari won't play without them),
// a 206 can't be stored, and one 20 MB clip evicts forty photos.
describe('service worker storage media routing', () => {
  const STORAGE = 'https://vrfsaazuqjxotnieqlkd.supabase.co/storage/v1/object/public/vault-images';

  it('treats storage photos as images and storage clips as video', () => {
    const { isStorageImage, isStorageVideo } = loadServiceWorker();

    expect(isStorageImage(new URL(`${STORAGE}/u1/1760000000000-front.webp`))).toBe(true);
    expect(isStorageVideo(new URL(`${STORAGE}/u1/1760000000000-front.webp`))).toBe(false);

    for (const ext of ['mp4', 'webm', 'mov', 'MP4']) {
      const clip = new URL(`${STORAGE}/u1/1760000000000-clip.${ext}`);
      expect(isStorageVideo(clip)).toBe(true);
      expect(isStorageImage(clip)).toBe(false);
    }

    // The same rule on the image CDN host and the transform endpoint.
    expect(isStorageVideo(new URL('https://img.cardpop.com.au/storage/v1/object/public/vault-images/u1/c.mp4'))).toBe(true);
    expect(isStorageImage(new URL('https://img.cardpop.com.au/storage/v1/render/image/public/vault-images/u1/c.webp?width=480'))).toBe(true);
  });

  it('recognises a Range request whatever the URL', () => {
    const { isRangeRequest } = loadServiceWorker();
    expect(isRangeRequest(new Request(`${STORAGE}/u1/c.mp4`, { headers: { Range: 'bytes=0-' } }))).toBe(true);
    expect(isRangeRequest(new Request(`${STORAGE}/u1/c.mp4`))).toBe(false);
  });

  it('purges clips an earlier version stored in the image cache, keeping the photos', async () => {
    const { purgeCachedVideos, deleted } = loadServiceWorker({
      keys: async () => [
        new Request(`${STORAGE}/u1/a.webp`),
        new Request(`${STORAGE}/u1/b.mp4`),
        new Request(`${STORAGE}/u1/c.webm`),
      ],
    });

    await purgeCachedVideos();

    expect(deleted).toEqual([`${STORAGE}/u1/b.mp4`, `${STORAGE}/u1/c.webm`]);
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
