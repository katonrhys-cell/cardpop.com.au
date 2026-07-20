// In-memory cache for Supabase queries with TTL and stale-while-revalidate fallback.
// Prevents redundant database hits on repeated queries within the TTL window.

const cache = new Map();
// De-dupe concurrent refreshes of the same key (foreground miss + any number of
// background stale reads share one in-flight request).
const inFlight = new Map();

export function getCachedQuery(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now < entry.expiresAt) {
    return entry.data;
  }

  // Cache expired but keep stale entry for fallback (1 hour window)
  if (now < entry.staleTtlEnd) {
    return entry.data;
  }

  cache.delete(key);
  return null;
}

// Run queryFn, store the result on success, and return it. Errors serve a stale
// success if one is in window, otherwise propagate uncached so the next caller
// retries. Refreshes for the same key are de-duped via `inFlight`.
function refresh(key, queryFn, ttlMs) {
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    try {
      const data = await queryFn();

      // Supabase queries resolve (never throw) with `{ data, error }`. A failed
      // response must not be cached: it would pin the failure for the whole TTL
      // (and up to the stale window), so one transient error left the homepage
      // empty long after the database recovered. Serve a stale success if we
      // have one, otherwise pass the failure through uncached.
      if (data && typeof data === 'object' && data.error) {
        const staleEntry = cache.get(key);
        if (staleEntry && Date.now() < staleEntry.staleTtlEnd) {
          console.warn(`[Cache] Query errored, serving stale: ${key}`, data.error);
          return staleEntry.data;
        }
        return data;
      }

      const now = Date.now();
      cache.set(key, {
        data,
        expiresAt: now + ttlMs,
        staleTtlEnd: now + 60 * 60 * 1000, // 1 hour stale window for fallback
      });
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export async function cachedQuery(key, queryFn, ttlMs = 5 * 60 * 1000) {
  const entry = cache.get(key);
  const now = entry ? Date.now() : 0;

  // Fresh: serve from cache, no network.
  if (entry && now < entry.expiresAt) return entry.data;

  // Stale (past TTL, within the 1-hour window): serve immediately AND kick off a
  // background revalidation so the next read is fresh. This is the "revalidate"
  // half of stale-while-revalidate that was previously missing — before, a stale
  // entry was returned for a full hour without ever refetching, so the 5-minute
  // TTL did nothing after the first expiry.
  if (entry && now < entry.staleTtlEnd) {
    refresh(key, queryFn, ttlMs).catch(() => {}); // background; failures are non-fatal (stale already served)
    return entry.data;
  }

  // Miss or fully expired: fetch synchronously.
  try {
    return await refresh(key, queryFn, ttlMs);
  } catch (error) {
    const staleEntry = cache.get(key);
    if (staleEntry && Date.now() < staleEntry.staleTtlEnd) {
      console.warn(`[Cache] Query failed, serving stale: ${key}`, error);
      return staleEntry.data;
    }
    throw error;
  }
}

export function invalidateCache(key) {
  cache.delete(key);
}

export function invalidateCachePattern(regex) {
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
    }
  }
}

export function clearCache() {
  cache.clear();
}

export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
