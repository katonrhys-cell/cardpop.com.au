// A tiny in-memory TTL cache with in-flight de-duplication.
//
// The API runs as one Vercel function; a warm instance serves many requests
// in a row, so caching a lookup for a few seconds removes a network round-trip
// from most of them while an instance that was never warmed behaves exactly
// as before. Nothing here is shared across instances — the TTLs are short so
// a change made elsewhere is visible within one window.
//
// `ttlMs` is read on every `get` (a function) so a test can switch caching
// off through an environment variable without re-importing the module; the
// backend test setup sets every cache's TTL to 0, which disables it.

export function createTtlCache({ ttlMs, maxEntries = 1000 } = {}) {
  const entries = new Map(); // key → { value, expiresAt }
  const inFlight = new Map(); // key → Promise

  const ttl = () => {
    const n = typeof ttlMs === 'function' ? Number(ttlMs()) : Number(ttlMs);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const evictIfFull = () => {
    if (entries.size < maxEntries) return;
    // Oldest insertion first (Map preserves insertion order).
    const first = entries.keys().next().value;
    if (first !== undefined) entries.delete(first);
  };

  return {
    /** Whether caching is on (TTL > 0). */
    enabled: () => ttl() > 0,

    /** Cached value, or undefined. */
    peek(key) {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= Date.now()) { entries.delete(key); return undefined; }
      return hit.value;
    },

    /**
     * Return the cached value for `key`, or run `loader()` (once, even under
     * concurrent calls) and cache its result. `maxTtlMs` caps this entry's
     * lifetime below the cache default (e.g. a token's own expiry).
     */
    async get(key, loader, { maxTtlMs } = {}) {
      const baseTtl = ttl();
      if (baseTtl <= 0) return loader();
      const cached = this.peek(key);
      if (cached !== undefined) return cached;
      const pending = inFlight.get(key);
      if (pending) return pending;
      const p = (async () => {
        try {
          const value = await loader();
          const life = Number.isFinite(maxTtlMs) ? Math.min(baseTtl, Math.max(0, maxTtlMs)) : baseTtl;
          if (value !== undefined && life > 0) {
            evictIfFull();
            entries.set(key, { value, expiresAt: Date.now() + life });
          }
          return value;
        } finally {
          inFlight.delete(key);
        }
      })();
      inFlight.set(key, p);
      return p;
    },

    set(key, value, lifeMs) {
      const life = Number.isFinite(lifeMs) ? lifeMs : ttl();
      if (life <= 0) return;
      evictIfFull();
      entries.set(key, { value, expiresAt: Date.now() + life });
    },

    delete(key) { entries.delete(key); },
    clear() { entries.clear(); inFlight.clear(); },
    size() { return entries.size; },
  };
}

export default createTtlCache;
