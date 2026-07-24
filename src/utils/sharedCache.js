import supabase from './supabaseClient.js';
import logger from './logger.js';

// Cross-instance cache backed by the api_cache table (service-role only —
// see the migration creating it). On Vercel each serverless instance has its
// own memory, so purely in-process caches (ebayCache, exchangeRates,
// cardImageResolver) start empty per instance and their TTLs are largely
// illusory. This layer makes a cached result visible to every instance.
//
// Strictly fail-open: any storage error behaves like a cache miss, so a
// broken cache can never take down the route using it.
export async function sharedCacheGet(key) {
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .select('value, expires_at')
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return null;
    if (new Date(data.expires_at).getTime() <= Date.now()) return null;
    return data.value;
  } catch (err) {
    logger.debug(`[SHARED_CACHE] get failed for ${key}: ${err.message}`);
    return null;
  }
}

export async function sharedCacheSet(key, value, ttlMs) {
  try {
    await supabase.from('api_cache').upsert({
      key,
      value,
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
      updated_at: new Date().toISOString(),
    });
    // Opportunistic cleanup so expired rows don't accumulate forever; cheap
    // (indexed on expires_at) and fire-and-forget.
    if (Math.random() < 0.02) {
      supabase
        .from('api_cache')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .then(() => {}, () => {});
    }
  } catch (err) {
    logger.debug(`[SHARED_CACHE] set failed for ${key}: ${err.message}`);
  }
}
