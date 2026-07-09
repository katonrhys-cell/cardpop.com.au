import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isStaleChunkError, STALE_CHUNK_RE, installChunkReloadGuard } from '@/lib/chunkReload.js';

describe('chunkReload — stale-chunk detection', () => {
  it('matches the deploy-related dynamic-import failures we see in Sentry', () => {
    expect(isStaleChunkError("'text/html' is not a valid JavaScript MIME type.")).toBe(true);
    expect(isStaleChunkError('Importing a module script failed.')).toBe(true);
    expect(isStaleChunkError('Failed to fetch dynamically imported module: https://cardpop.com.au/assets/MarketplacePage-abc123.js')).toBe(true);
    expect(isStaleChunkError('error loading dynamically imported module')).toBe(true);
    expect(isStaleChunkError("Unexpected token '<'")).toBe(true);
    expect(isStaleChunkError('ChunkLoadError: Loading chunk 42 failed')).toBe(true);
    expect(isStaleChunkError('Loading chunk 7 failed')).toBe(true);
  });

  it('ignores unrelated runtime errors', () => {
    expect(isStaleChunkError('TypeError: undefined is not a function')).toBe(false);
    expect(isStaleChunkError('Network request failed')).toBe(false);
    expect(isStaleChunkError('')).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });

  it('exports a case-insensitive regex', () => {
    expect(STALE_CHUNK_RE.test('IMPORTING A MODULE SCRIPT FAILED')).toBe(true);
  });
});

describe('chunkReload — guard reload behaviour', () => {
  let reloadSpy;
  let cachesDelete;

  beforeEach(() => {
    sessionStorage.clear();
    reloadSpy = vi.fn();
    // happy-dom's location.reload isn't a spy; replace just that method.
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
      configurable: true,
    });
    cachesDelete = vi.fn().mockResolvedValue(true);
    globalThis.caches = {
      keys: vi.fn().mockResolvedValue(['cardpop-static-v4', 'cardpop-pages-v4']),
      delete: cachesDelete,
    };
    globalThis.navigator.serviceWorker = {
      getRegistrations: vi.fn().mockResolvedValue([{ unregister: vi.fn().mockResolvedValue(true) }]),
    };
    installChunkReloadGuard();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.caches;
    delete globalThis.navigator.serviceWorker;
  });

  const flush = () => new Promise((r) => setTimeout(r, 0));

  // happy-dom has no PromiseRejectionEvent — dispatch a plain event carrying the
  // `reason` the guard reads.
  const rejectWith = (message) => {
    const event = new Event('unhandledrejection');
    event.reason = new Error(message);
    window.dispatchEvent(event);
  };

  it('purges caches and reloads once on a stale-chunk unhandledrejection', async () => {
    rejectWith('Importing a module script failed.');
    await flush();
    expect(cachesDelete).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reload again within the cooldown window (no loop)', async () => {
    // Simulate a very recent reload already recorded.
    sessionStorage.setItem('cardpop-chunk-reload-ts', String(Date.now()));
    rejectWith('ChunkLoadError');
    await flush();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('ignores unrelated rejections', async () => {
    rejectWith('Some other bug');
    await flush();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
