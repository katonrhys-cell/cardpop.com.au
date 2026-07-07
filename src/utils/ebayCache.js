import logger from './logger.js';

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

export { set, get, clear };