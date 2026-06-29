// In-memory cache for Supabase queries with TTL and stale-while-revalidate fallback.
// Prevents redundant database hits on repeated queries within the TTL window.

const cache = new Map();

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

export async function cachedQuery(key, queryFn, ttlMs = 5 * 60 * 1000) {
  const cached = getCachedQuery(key);
  if (cached) return cached;

  try {
    const data = await queryFn();
    const now = Date.now();

    cache.set(key, {
      data,
      expiresAt: now + ttlMs,
      staleTtlEnd: now + 60 * 60 * 1000, // 1 hour stale window for fallback
    });

    return data;
  } catch (error) {
    // Serve stale cache on error if available
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
