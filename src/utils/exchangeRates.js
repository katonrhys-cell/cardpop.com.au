import logger from './logger.js';

// Used only when the rate API is unreachable and nothing is cached
const FALLBACK_USD_TO_AUD = 1.55;
const RATE_TTL_MS = 12 * 60 * 60 * 1000;
const RATE_API_URL = 'https://open.er-api.com/v6/latest/USD';

let cached = null; // { rate, fetchedAt }

/**
 * Returns the current USD→AUD exchange rate, cached in memory for 12 hours.
 * Falls back to the last known rate, then a hardcoded constant, on failure.
 *
 * @returns {Promise<number>}
 */
export async function getUsdToAudRate() {
	if (cached && Date.now() - cached.fetchedAt < RATE_TTL_MS) {
		return cached.rate;
	}

	try {
		const response = await fetch(RATE_API_URL);
		if (!response.ok) throw new Error(`rate API responded ${response.status}`);
		const data = await response.json();
		const rate = data?.rates?.AUD;
		if (!(rate > 0)) throw new Error('AUD rate missing from response');
		cached = { rate, fetchedAt: Date.now() };
		return rate;
	} catch (err) {
		const fallback = cached?.rate ?? FALLBACK_USD_TO_AUD;
		logger.warn(`[FX] USD→AUD rate fetch failed (${err.message}); using ${fallback}`);
		return fallback;
	}
}

// Test hook — resets the in-memory cache
export function _resetRateCache() {
	cached = null;
}
