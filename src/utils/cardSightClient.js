import process from 'node:process';
import 'dotenv/config';
import { CardSightAI } from 'cardsightai';
import { getUsdToAudRate } from './exchangeRates.js';
import logger from './logger.js';

let _client = null;

export function getCardSightClient() {
	if (!_client) {
		// CARDSIGHT_API_KEY is the documented name (.env.example); CARDSIGHTAI_API_KEY
		// is the SDK's own default, accepted as a fallback.
		const apiKey = process.env.CARDSIGHT_API_KEY || process.env.CARDSIGHTAI_API_KEY;
		if (!apiKey) {
			throw new Error('CardSight API not configured: set CARDSIGHT_API_KEY');
		}
		_client = new CardSightAI({ apiKey });
	}
	return _client;
}

/**
 * Flattens a CardSight PricingResponse (raw + graded sale records) into the
 * aggregate stats shape the rest of the app consumes. CardSight prices are USD.
 *
 * @param {object|null|undefined} pricing - PricingResponse payload
 * @returns {{ avgPrice: number, minPrice: number, maxPrice: number, salesCount: number, lastSalePrice: number|null, lastSaleDate: string|null, currency: string }|null}
 */
export function summarisePricing(pricing) {
	if (!pricing) return null;

	const records = [
		...(pricing.raw?.records ?? []),
		...(pricing.graded ?? []).flatMap(company =>
			(company.grades ?? []).flatMap(grade => grade.records ?? [])
		),
	].filter(record => record?.price > 0);

	if (!records.length) return null;

	const prices = records.map(record => record.price);
	const newestFirst = [...records].sort(
		(a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0)
	);
	const round2 = n => Math.round(n * 100) / 100;

	return {
		avgPrice: round2(prices.reduce((sum, p) => sum + p, 0) / prices.length),
		minPrice: round2(Math.min(...prices)),
		maxPrice: round2(Math.max(...prices)),
		salesCount: prices.length,
		lastSalePrice: newestFirst[0].price ?? null,
		lastSaleDate: newestFirst[0].date ?? null,
		currency: 'USD',
	};
}

/**
 * Like summarisePricing, but converts the USD aggregates to AUD using the
 * current exchange rate. Includes the rate used as `fxRate`.
 *
 * @param {object|null|undefined} pricing - PricingResponse payload
 * @returns {Promise<object|null>}
 */
export async function summarisePricingAud(pricing) {
	const summary = summarisePricing(pricing);
	if (!summary) return null;

	const rate = await getUsdToAudRate();
	const round2 = n => Math.round(n * 100) / 100;

	return {
		...summary,
		avgPrice: round2(summary.avgPrice * rate),
		minPrice: round2(summary.minPrice * rate),
		maxPrice: round2(summary.maxPrice * rate),
		lastSalePrice: summary.lastSalePrice != null ? round2(summary.lastSalePrice * rate) : null,
		currency: 'AUD',
		fxRate: rate,
	};
}

// Segment id → name cache (segments are a small, near-static catalog)
let _segmentMap = null;

/**
 * Resolves a CardSight segment UUID to its display name (e.g. "Pokemon",
 * "Basketball"). Returns null when unknown or the lookup fails.
 *
 * @param {string|null|undefined} segmentId
 * @returns {Promise<string|null>}
 */
export async function getSegmentName(segmentId) {
	if (!segmentId) return null;

	if (!_segmentMap) {
		try {
			const { data } = await getCardSightClient().catalog.segments({ take: 100 });
			_segmentMap = new Map((data?.segments ?? []).map(s => [s.id, s.name]));
		} catch (err) {
			logger.warn(`[CARDSIGHT] Failed to load segments: ${err.message}`);
			return null;
		}
	}

	return _segmentMap.get(segmentId) ?? null;
}
