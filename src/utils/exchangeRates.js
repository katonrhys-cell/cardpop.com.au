import logger from './logger.js';

// In-memory cache for exchange rates
let exchangeRateCache = {
  usdToAud: null,
  lastUpdated: null,
  cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};

/**
 * Fetch current USD to AUD exchange rate
 * Uses exchangerate-api.com free tier (no API key required for basic usage)
 * Caches for 24 hours
 */
async function getUsdToAudRate() {
  const now = Date.now();
  const timeSinceLastUpdate = now - (exchangeRateCache.lastUpdated || 0);

  // Return cached rate if still valid
  if (
    exchangeRateCache.usdToAud &&
    exchangeRateCache.lastUpdated &&
    timeSinceLastUpdate < exchangeRateCache.cacheExpiry
  ) {
    logger.debug('[EXCHANGE_RATES] Returning cached USD→AUD rate');
    return exchangeRateCache.usdToAud;
  }

  try {
    logger.info('[EXCHANGE_RATES] Fetching fresh USD→AUD rate');

    // Using exchangerate-api.com free API (no key required for basic requests)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      headers: {
        'User-Agent': 'CardPopBot/1.0',
      },
    });

    if (!response.ok) {
      logger.warn(`[EXCHANGE_RATES] API returned ${response.status}, using fallback rate`);
      return getFallbackRate();
    }

    const data = await response.json();
    const rate = data.rates?.AUD;

    if (!rate) {
      logger.warn('[EXCHANGE_RATES] AUD rate not found in response');
      return getFallbackRate();
    }

    // Cache the rate
    exchangeRateCache.usdToAud = rate;
    exchangeRateCache.lastUpdated = now;

    logger.info(`[EXCHANGE_RATES] Fetched USD→AUD rate: ${rate.toFixed(4)}`);
    return rate;
  } catch (error) {
    logger.error(`[EXCHANGE_RATES] Error fetching rate: ${error.message}`);
    return getFallbackRate();
  }
}

/**
 * Fallback rate if API is unavailable
 * Using approximate rate - not ideal but prevents complete failure
 */
function getFallbackRate() {
  // Approximate fallback rate (AUD is typically 1.4-1.6 per USD)
  // This is a reasonable middle ground but will be outdated
  const fallbackRate = 1.52;
  logger.warn(`[EXCHANGE_RATES] Using fallback rate: ${fallbackRate}`);
  return fallbackRate;
}

/**
 * Convert USD to AUD with current rate
 */
async function convertUsdToAud(usdAmount) {
  if (!usdAmount || isNaN(usdAmount)) {
    return null;
  }

  const rate = await getUsdToAudRate();
  return Number((usdAmount * rate).toFixed(2));
}

/**
 * Get exchange rate with timestamp info
 */
async function getExchangeRateInfo() {
  const rate = await getUsdToAudRate();
  const lastUpdated = exchangeRateCache.lastUpdated;
  const nextUpdateTime = lastUpdated + exchangeRateCache.cacheExpiry;

  return {
    rate: Number(rate.toFixed(4)),
    lastUpdatedAt: lastUpdated ? new Date(lastUpdated).toISOString() : null,
    nextUpdateAt: new Date(nextUpdateTime).toISOString(),
    cacheHours: exchangeRateCache.cacheExpiry / (60 * 60 * 1000),
  };
}

function _resetRateCache() {
  exchangeRateCache = {
    usdToAud: null,
    lastUpdated: null,
    cacheExpiry: 24 * 60 * 60 * 1000,
  };
}

export { getUsdToAudRate, convertUsdToAud, getExchangeRateInfo, _resetRateCache };
