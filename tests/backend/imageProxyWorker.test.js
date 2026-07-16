import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker, { canonicalSearch } from '../../cloudflare/image-proxy-worker.js';

const OBJECT_PATH = '/storage/v1/object/public/vault-images/123-card.webp';
const RENDER_PATH = '/storage/v1/render/image/public/vault-images/123-card.webp';

// ─── canonicalSearch: cache-key canonicalisation ──────────────────────────────

describe('canonicalSearch', () => {
  it('strips ALL query params from /object/ paths (cache-busting defence)', () => {
    expect(canonicalSearch(OBJECT_PATH, new URLSearchParams('cachebust=8371&x=y'))).toBe('');
    expect(canonicalSearch(OBJECT_PATH, new URLSearchParams('width=240'))).toBe('');
    expect(canonicalSearch(OBJECT_PATH, new URLSearchParams(''))).toBe('');
  });

  it('keeps only known transform params on /render/image/ paths, sorted', () => {
    const params = new URLSearchParams('resize=cover&quality=75&width=240&evil=1');
    expect(canonicalSearch(RENDER_PATH, params)).toBe('?quality=75&resize=cover&width=240');
  });

  it('snaps arbitrary widths up to the ladder so permutations collapse', () => {
    expect(canonicalSearch(RENDER_PATH, new URLSearchParams('width=241'))).toBe('?width=320');
    expect(canonicalSearch(RENDER_PATH, new URLSearchParams('width=239'))).toBe('?width=240');
    // over the top of the ladder → capped at the max step
    expect(canonicalSearch(RENDER_PATH, new URLSearchParams('width=99999'))).toBe('?width=2560');
  });

  it("preserves the app's own transform requests exactly (ladder-aligned widths)", () => {
    // getCardImage() requests width ∈ {240, 400→480, 600→640}, quality 75, resize cover.
    expect(canonicalSearch(RENDER_PATH, new URLSearchParams('width=240&quality=75&resize=cover')))
      .toBe('?quality=75&resize=cover&width=240');
  });

  it('drops invalid or garbage transform values', () => {
    expect(canonicalSearch(RENDER_PATH, new URLSearchParams('width=abc&quality=-5&resize=zoom&format=webp')))
      .toBe('');
    expect(canonicalSearch(RENDER_PATH, new URLSearchParams('format=origin'))).toBe('?format=origin');
  });
});

// ─── fetch handler ────────────────────────────────────────────────────────────

describe('worker fetch handler', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('img-bytes', { status: 200, headers: { 'Content-Type': 'image/webp' } })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const run = (path, opts) => worker.fetch(new Request(`https://img.cardpop.com.au${path}`, opts));

  it('proxies allowed object paths with the query stripped from the origin fetch', async () => {
    const res = await run(`${OBJECT_PATH}?cachebust=12345`);
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `https://odoglvswwymyjuwlonkf.supabase.co${OBJECT_PATH}`
    );
  });

  it('canonicalises render-path queries before hitting origin', async () => {
    await run(`${RENDER_PATH}?evil=1&width=250&quality=75`);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `https://odoglvswwymyjuwlonkf.supabase.co${RENDER_PATH}?quality=75&width=320`
    );
  });

  it('rejects non-storage paths without contacting origin', async () => {
    const res = await run('/rest/v1/profiles?select=*');
    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects private-bucket and auth paths', async () => {
    expect((await run('/storage/v1/object/sign/private-bucket/x.webp')).status).toBe(404);
    expect((await run('/auth/v1/token')).status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects non-GET/HEAD methods', async () => {
    const res = await run(OBJECT_PATH, { method: 'POST', body: 'x' });
    expect(res.status).toBe(405);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sets long immutable cache headers and CORS on success', async () => {
    const res = await run(OBJECT_PATH);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('does not force long cache headers onto error responses', async () => {
    fetchSpy.mockResolvedValue(new Response('missing', { status: 404 }));
    const res = await run(OBJECT_PATH);
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).not.toBe('public, max-age=31536000, immutable');
  });

  it('neutralises SVG responses (force download + CSP sandbox) to block stored XSS', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      })
    );
    const res = await run('/storage/v1/object/public/media/evil.svg');
    expect(res.headers.get('Content-Disposition')).toBe('attachment');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toContain('sandbox');
  });

  it('leaves non-SVG images inline (no attachment disposition)', async () => {
    const res = await run(OBJECT_PATH);
    expect(res.headers.get('Content-Disposition')).toBeNull();
    expect(res.headers.get('Content-Security-Policy')).toBeNull();
  });

  it('scopes the year-long edge cache TTL to 2xx only, so a transient error is never pinned at the edge for a year', async () => {
    await run(OBJECT_PATH);
    const cf = fetchSpy.mock.calls[0][1].cf;
    expect(cf.cacheEverything).toBe(true);
    expect(cf.cacheTtlByStatus['200-299']).toBe(31536000);
    expect(cf.cacheTtlByStatus['400-599']).toBe(0);
    expect(cf.cacheTtl).toBeUndefined();
  });
});

// ─── R2 fast path ─────────────────────────────────────────────────────────────

describe('worker R2 fast path', () => {
  let fetchSpy, cachePut;

  // Stub the edge Cache API (caches.default) — absent in the Node test runtime.
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('supabase-bytes', { status: 200, headers: { 'Content-Type': 'image/webp' } })
    );
    cachePut = vi.fn().mockResolvedValue(undefined);
    globalThis.caches = { default: { match: vi.fn().mockResolvedValue(undefined), put: cachePut } };
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete globalThis.caches;
  });

  // An R2 bucket whose get() returns a stored object for `presentKey` only,
  // and a put() that records write-through migrations.
  const bucketWith = (presentKey) => ({
    get: vi.fn(async (key) =>
      key === presentKey
        ? {
            body: 'r2-bytes',
            httpEtag: '"abc"',
            writeHttpMetadata: (h) => h.set('Content-Type', 'image/webp'),
          }
        : null
    ),
    put: vi.fn().mockResolvedValue(undefined),
  });

  const ctx = { waitUntil: vi.fn() };
  const run = (path, env, opts) =>
    worker.fetch(new Request(`https://img.cardpop.com.au${path}`, opts), env, ctx);

  it('serves a migrated object from R2 without touching Supabase', async () => {
    const env = { IMAGES: bucketWith('vault-images/123-card.webp') };
    const res = await run(OBJECT_PATH, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('r2-bytes');
    expect(env.IMAGES.get).toHaveBeenCalledWith('vault-images/123-card.webp');
    expect(fetchSpy).not.toHaveBeenCalled(); // no Supabase egress
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('x-image-source')).toBe('r2'); // observability marker
    expect(ctx.waitUntil).toHaveBeenCalled(); // edge-cached
  });

  it('falls through to the Supabase proxy when the object is not in R2', async () => {
    const env = { IMAGES: bucketWith('some/other/object.webp') };
    const res = await run(OBJECT_PATH, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('supabase-bytes');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('never serves render/transform paths from R2 (R2 cannot resize)', async () => {
    const env = { IMAGES: bucketWith('vault-images/123-card.webp') };
    await run(RENDER_PATH, env);
    expect(env.IMAGES.get).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1); // proxied to Supabase
  });

  it('ignores cache-busting query strings when keying the R2 object', async () => {
    const env = { IMAGES: bucketWith('vault-images/123-card.webp') };
    const res = await run(`${OBJECT_PATH}?cachebust=999`, env);
    expect(res.status).toBe(200);
    expect(env.IMAGES.get).toHaveBeenCalledWith('vault-images/123-card.webp');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns a bodyless response for a HEAD hit', async () => {
    const env = { IMAGES: bucketWith('vault-images/123-card.webp') };
    const res = await run(OBJECT_PATH, env, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  // ── lazy write-through migration ──────────────────────────────────────────

  it('writes an object through to R2 on a proxy miss, and still returns the bytes', async () => {
    const env = { IMAGES: bucketWith('not-this-key') }; // get() miss → proxy
    const res = await run(OBJECT_PATH, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('supabase-bytes'); // client still served
    expect(fetchSpy).toHaveBeenCalledTimes(1); // one Supabase read
    expect(env.IMAGES.put).toHaveBeenCalledTimes(1);
    expect(env.IMAGES.put.mock.calls[0][0]).toBe('vault-images/123-card.webp');
    expect(env.IMAGES.put.mock.calls[0][2]).toEqual({
      httpMetadata: { contentType: 'image/webp' },
    });
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it('does not write through for a HEAD request (no body to migrate)', async () => {
    const env = { IMAGES: bucketWith('not-this-key') };
    await run(OBJECT_PATH, env, { method: 'HEAD' });
    expect(env.IMAGES.put).not.toHaveBeenCalled();
  });

  it('does not write a non-2xx response into R2', async () => {
    fetchSpy.mockResolvedValue(new Response('missing', { status: 404 }));
    const env = { IMAGES: bucketWith('not-this-key') };
    const res = await run(OBJECT_PATH, env);
    expect(res.status).toBe(404);
    expect(env.IMAGES.put).not.toHaveBeenCalled();
  });

  it('never write-through migrates render/transform paths', async () => {
    const env = { IMAGES: bucketWith('not-this-key') };
    await run(RENDER_PATH, env);
    expect(env.IMAGES.put).not.toHaveBeenCalled();
  });
});
