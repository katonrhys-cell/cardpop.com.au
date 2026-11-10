/**
 * Address → coordinates for the Local Map, looked up once and shared.
 *
 * Reads `geocode_cache` for every requested query; any that are missing (or a
 * stale "not found") are fetched from OpenStreetMap's Nominatim one at a time,
 * at most one per NOMINATIM_SPACING_MS as its usage policy requires, until the
 * per-request time budget runs out. The rest are reported as pending and get
 * looked up on a later request — so the first few visits after new events are
 * added fill the cache, and from then on no visit calls Nominatim at all.
 */
import supabase from './supabaseClient.js';
import logger from './logger.js';
import { OUTBOUND_TIMEOUT_MS } from './outboundTimeouts.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_SPACING_MS = 1100;
const NOT_FOUND_RETRY_MS = 30 * 24 * 60 * 60 * 1000;
const READ_CHUNK = 200;
const USER_AGENT = 'CardPop.com.au/1.0 (+https://cardpop.com.au)';

export const normaliseQueryKey = (q) => String(q || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readCached(keys) {
  const out = new Map();
  for (let i = 0; i < keys.length; i += READ_CHUNK) {
    const { data, error } = await supabase
      .from('geocode_cache')
      .select('query_key, lat, lng, found, geocoded_at')
      .in('query_key', keys.slice(i, i + READ_CHUNK));
    if (error) throw error;
    for (const row of data || []) out.set(row.query_key, row);
  }
  return out;
}

async function lookup(key) {
  const params = new URLSearchParams({ q: `${key}, Australia`, format: 'json', limit: '1', countrycodes: 'au' });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.nominatim),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = await res.json();
  const hit = Array.isArray(data) ? data[0] : null;
  const lat = hit ? Number.parseFloat(hit.lat) : NaN;
  const lng = hit ? Number.parseFloat(hit.lon) : NaN;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, found: true } : { lat: null, lng: null, found: false };
}

/**
 * @param {string[]} queries   address strings (as built by lib/geocode.js)
 * @param {{ budgetMs?: number, now?: number }} [opts]
 * @returns {Promise<{ results: Record<string, [number, number] | null>, pending: string[] }>}
 */
export async function geocodeQueries(queries, { budgetMs = 8000, now = Date.now() } = {}) {
  const keys = [...new Set((queries || []).map(normaliseQueryKey).filter(Boolean))];
  const results = {};
  const pending = [];
  if (!keys.length) return { results, pending };

  const cached = await readCached(keys);
  const misses = [];
  for (const key of keys) {
    const row = cached.get(key);
    const staleMiss = row && !row.found && now - new Date(row.geocoded_at).getTime() > NOT_FOUND_RETRY_MS;
    if (row && !staleMiss) results[key] = row.found ? [row.lat, row.lng] : null;
    else misses.push(key);
  }

  const deadline = now + budgetMs;
  for (let i = 0; i < misses.length; i += 1) {
    const key = misses[i];
    if (Date.now() + OUTBOUND_TIMEOUT_MS.nominatim > deadline) { pending.push(...misses.slice(i)); break; }
    try {
      const hit = await lookup(key);
      results[key] = hit.found ? [hit.lat, hit.lng] : null;
      const { error } = await supabase.from('geocode_cache').upsert(
        { query_key: key, ...hit, geocoded_at: new Date().toISOString() },
        { onConflict: 'query_key' },
      );
      if (error) logger.warn(`[GEOCODE] cache write failed: ${error.message}`);
    } catch (err) {
      // A transient failure is not cached; the key is retried next request.
      logger.warn(`[GEOCODE] lookup failed: ${err.message}`);
      pending.push(key);
    }
    if (i < misses.length - 1) await sleep(NOMINATIM_SPACING_MS);
  }
  return { results, pending };
}
