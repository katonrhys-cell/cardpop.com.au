import logger from './logger.js';

const cache = new Map();
const CACHE_TTL = parseInt(process.env.EBAY_CACHE_TTL || '3600', 10) * 1000;

function set(key, value) {
  const expiresAt = Date.now() + CACHE_TTL;
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