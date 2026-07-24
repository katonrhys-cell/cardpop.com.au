import logger from './logger.js';
import { sharedCacheGet, sharedCacheSet } from './sharedCache.js';

const cache = new Map();
const CACHE_TTL = parseInt(process.env.EBAY_CACHE_TTL || '3600', 10) * 1000;
// Some cache keys are derived from per-card/per-filter-combination values
// (ebay_card_<id>, ebay_sales_<filters>), so the key space grows with
// traffic rather than staying fixed — cap entries so a long-running process
// can't grow this Map unbounded. Map preserves insertion order, so deleting
// the first key evicts the oldest entry (FIFO).
const MAX_ENTRIES = 500;

function set(key, value) {
  const expiresAt = Date.now() + CACHE_TTL;
  if (!cache.has(key) && cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
    logger.debug(`Cache EVICTED (at capacity): ${oldestKey}`);
  }
  cache.set(key, { value, expiresAt });
  logger.debug(`Cache SET: ${key} (expires in ${CACHE_TTL / 1000}s)`);
}

function get(key) {
  const entry = cache.get(key);
  
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    logger.debug(`Cache EXPIRED: ${key}`);
    return null;
  }

  logger.debug(`Cache HIT: ${key}`);
  return entry.value;
}

function clear() {
  cache.clear();
  logger.debug('Cache cleared');
}

// Two-tier variants: in-memory L1 (this Map) + the cross-instance api_cache
// table (L2). On Vercel each serverless instance has its own Map, so the L1
// hit rate is low on its own — the shared layer makes results visible across
// instances. L2 failures behave like misses (sharedCache is fail-open).
async function getTiered(key) {
  const memory = get(key);
  if (memory !== null) return memory;
  const shared = await sharedCacheGet(`ebay:${key}`);
  if (shared !== null) {
    set(key, shared); // hydrate L1 for this instance
    logger.debug(`Cache HIT (shared): ${key}`);
  }
  return shared;
}

async function setTiered(key, value) {
  set(key, value);
  await sharedCacheSet(`ebay:${key}`, value, CACHE_TTL);
}

export { set, get, clear, getTiered, setTiered };