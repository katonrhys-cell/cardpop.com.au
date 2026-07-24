import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// sharedCache hits the real Supabase client (network) — stub it out.
vi.mock('../../../src/utils/sharedCache.js', () => ({
  sharedCacheGet: vi.fn(async () => null),
  sharedCacheSet: vi.fn(async () => {}),
}));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getUsdToAudRate, _resetRateCache } from '../../../src/utils/exchangeRates.js';
import { summarisePricing, summarisePricingAud } from '../../../src/utils/cardSightClient.js';

const rateResponse = (aud) => ({
  ok: true,
  json: async () => ({ rates: { AUD: aud } }),
});

beforeEach(() => {
  _resetRateCache();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── getUsdToAudRate ──────────────────────────────────────────────────────────

describe('getUsdToAudRate', () => {
  it('returns the rate from the API', async () => {
    fetch.mockResolvedValueOnce(rateResponse(1.6));
    expect(await getUsdToAudRate()).toBe(1.6);
  });

  it('caches the rate across calls', async () => {
    fetch.mockResolvedValueOnce(rateResponse(1.6));
    await getUsdToAudRate();
    await getUsdToAudRate();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to a positive constant when the API fails and nothing is cached', async () => {
    fetch.mockRejectedValueOnce(new Error('network down'));
    const rate = await getUsdToAudRate();
    expect(rate).toBeGreaterThan(0);
  });

  it('falls back to the last cached rate when a refresh fails', async () => {
    vi.useFakeTimers();
    try {
      fetch.mockResolvedValueOnce(rateResponse(1.7));
      await getUsdToAudRate();
      vi.advanceTimersByTime(13 * 60 * 60 * 1000); // past the 12h TTL
      fetch.mockRejectedValueOnce(new Error('network down'));
      expect(await getUsdToAudRate()).toBe(1.7);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a malformed rate payload', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rates: {} }) });
    const rate = await getUsdToAudRate();
    expect(rate).toBeGreaterThan(0); // hardcoded fallback
  });
});

// ─── summarisePricing / summarisePricingAud ──────────────────────────────────

const pricingPayload = {
  raw: {
    records: [
      { price: 10, date: '2026-01-01' },
      { price: 20, date: '2026-02-01' },
    ],
  },
  graded: [
    {
      company_name: 'PSA',
      grades: [{ grade_value: '10', records: [{ price: 30, date: '2026-03-01' }] }],
    },
  ],
};

describe('summarisePricing', () => {
  it('aggregates raw and graded records in USD', () => {
    const summary = summarisePricing(pricingPayload);
    expect(summary).toEqual({
      avgPrice: 20,
      minPrice: 10,
      maxPrice: 30,
      salesCount: 3,
      lastSalePrice: 30,
      lastSaleDate: '2026-03-01',
      currency: 'USD',
    });
  });

  it('returns null for empty or missing pricing', () => {
    expect(summarisePricing(null)).toBeNull();
    expect(summarisePricing({ raw: { records: [] }, graded: [] })).toBeNull();
  });
});

describe('summarisePricingAud', () => {
  it('converts all price fields to AUD using the live rate', async () => {
    fetch.mockResolvedValueOnce(rateResponse(1.5));
    const summary = await summarisePricingAud(pricingPayload);
    expect(summary).toEqual({
      avgPrice: 30,
      minPrice: 15,
      maxPrice: 45,
      salesCount: 3,
      lastSalePrice: 45,
      lastSaleDate: '2026-03-01',
      currency: 'AUD',
      fxRate: 1.5,
    });
  });

  it('returns null when there is nothing to convert', async () => {
    expect(await summarisePricingAud(null)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
