/**
 * Simple in-memory query cache for Supabase requests.
 * Reduces database load and improves perceived performance for repeated data.
 *
 * Usage:
 *   const data = await cachedQuery('featured_cards', () => supabase.from('...').select('...'), 5 * 60 * 1000)
 *
 * Note: This cache is per-session (browser). For multi-device sync, use Supabase Realtime.
 */

const queryCache = new Map();

export function getCachedQuery(key) {
  const cached = queryCache.get(key);
  if (!cached) return null;

  const isExpired = Date.now() > cached.expiresAt;
  if (isExpired) {
    queryCache.delete(key);
    return null;
  }

  return cached.data;
}

export async function cachedQuery(key, queryFn, ttlMs = 5 * 60 * 1000) {
  // Check cache first
  const cached = getCachedQuery(key);
  if (cached !== null) {
    return cached;
  }

  // Run query and cache result
  try {
    const result = await queryFn();
    queryCache.set(key, {
      data: result,
      expiresAt: Date.now() + ttlMs,
    });
    return result;
  } catch (error) {
    // On error, try to return stale cache (1-hour window)
    const stale = queryCache.get(key);
    if (stale && Date.now() < stale.expiresAt + 60 * 60 * 1000) {
      console.warn(`Query failed, serving stale cache for ${key}:`, error);
      return stale.data;
    }
    throw error;
  }
}

export function invalidateCache(key) {
  queryCache.delete(key);
}

export function invalidateCachePattern(pattern) {
  const regex = new RegExp(pattern);
  for (const key of queryCache.keys()) {
    if (regex.test(key)) {
      queryCache.delete(key);
    }
  }
}

export function clearCache() {
  queryCache.clear();
}

export function getCacheStats() {
  return {
    size: queryCache.size,
    keys: Array.from(queryCache.keys()),
  };
}
