import { supabase } from './supabaseClient.js';
import { createTtlCache } from './ttlCache.js';

// Cached reads of `platform_settings`.
//
// The pricing path reads these one key at a time — commission toggles, GST,
// shipping, processing fee — and `priceCart` re-reads several per cart line,
// so one `/stripe/calculate-cart` call (a live preview while the buyer types)
// was ~15 sequential round-trips before the first product row was fetched.
// Settings change rarely and only from Admin → Settings, so each key is cached
// per instance for PLATFORM_SETTINGS_TTL_MS (default 30 s). Admin edits are
// written straight from the browser (RLS), so a change is visible to the API
// within one window; set the TTL to 0 to disable.
//
// Single-key reads keep the exact `select('value').eq('key', k).maybeSingle()`
// shape the services always used, so the existing per-key test stubs hold.

const cache = createTtlCache({ ttlMs: () => process.env.PLATFORM_SETTINGS_TTL_MS ?? 30_000 });

// A row that doesn't exist is as cacheable as one that does.
const MISSING = Symbol('missing');

async function readOne(key) {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value !== undefined ? data.value : MISSING;
}

/** The stored value for `key`, or `defaultValue` when there is no row. */
export async function getPlatformSetting(key, defaultValue) {
  const value = await cache.get(key, () => readOne(key));
  return value === MISSING || value === undefined ? defaultValue : value;
}

/**
 * Several keys in one query (`{ key: value }`, missing keys absent). Keys the
 * cache already holds are not re-read.
 */
export async function getPlatformSettings(keys) {
  const out = {};
  const toFetch = [];
  for (const key of keys) {
    const hit = cache.enabled() ? cache.peek(key) : undefined;
    if (hit === undefined) toFetch.push(key);
    else if (hit !== MISSING) out[key] = hit;
  }
  if (toFetch.length > 0) {
    const { data } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', toFetch);
    const found = new Map((data || []).map((r) => [r.key, r.value]));
    for (const key of toFetch) {
      const value = found.has(key) ? found.get(key) : MISSING;
      cache.set(key, value);
      if (value !== MISSING) out[key] = value;
    }
  }
  return out;
}

/** Forget cached settings (after an admin write on this instance, or in tests). */
export function invalidatePlatformSettings(key) {
  if (key === undefined) cache.clear();
  else cache.delete(key);
}
