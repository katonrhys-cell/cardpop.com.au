import { spawnSync } from 'node:child_process';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSegments = vi.hoisted(() => vi.fn());
const CardSightCtor = vi.hoisted(() => vi.fn());
const mockGetRate = vi.hoisted(() => vi.fn());

vi.mock('cardsightai', () => ({
  CardSightAI: class {
    constructor(opts) {
      CardSightCtor(opts);
      this.catalog = { segments: mockSegments };
    }
  },
}));
vi.mock('../../../src/utils/exchangeRates.js', () => ({ getUsdToAudRate: mockGetRate }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { summarisePricing } from '../../../src/utils/cardSightClient.js';

async function load() {
  vi.resetModules();
  return import('../../../src/utils/cardSightClient.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CARDSIGHT_API_KEY = 'test-key';
  mockGetRate.mockResolvedValue(1.5);
});

// ─── summarisePricing (pure) ────────────────────────────────────────────────────

describe('summarisePricing', () => {
  it('returns null for null/empty input', () => {
    expect(summarisePricing(null)).toBeNull();
    expect(summarisePricing(undefined)).toBeNull();
    expect(summarisePricing({})).toBeNull();
  });

  it('aggregates raw records into avg/min/max/count', () => {
    const pricing = {
      raw: { records: [
        { price: 10, date: '2026-01-01' },
        { price: 20, date: '2026-01-02' },
        { price: 30, date: '2026-01-03' },
      ] },
    };
    const result = summarisePricing(pricing);
    expect(result).toMatchObject({
      avgPrice: 20, minPrice: 10, maxPrice: 30, salesCount: 3, currency: 'USD',
    });
  });

  it('flattens graded records across companies and grades', () => {
    const pricing = {
      graded: [
        { grades: [{ records: [{ price: 100, date: '2026-01-01' }] }] },
        { grades: [{ records: [{ price: 200, date: '2026-01-02' }] }] },
      ],
    };
    const result = summarisePricing(pricing);
    expect(result.salesCount).toBe(2);
    expect(result.avgPrice).toBe(150);
  });

  it('ignores records with non-positive prices', () => {
    const pricing = { raw: { records: [{ price: 0 }, { price: -5 }, { price: 40, date: 'x' }] } };
    const result = summarisePricing(pricing);
    expect(result.salesCount).toBe(1);
    expect(result.avgPrice).toBe(40);
  });

  it('reports the most recent sale by date', () => {
    const pricing = {
      raw: { records: [
        { price: 10, date: '2026-01-01' },
        { price: 99, date: '2026-06-01' },
        { price: 50, date: '2026-03-01' },
      ] },
    };
    const result = summarisePricing(pricing);
    expect(result.lastSalePrice).toBe(99);
    expect(result.lastSaleDate).toBe('2026-06-01');
  });

  it('rounds aggregates to two decimals', () => {
    const pricing = { raw: { records: [{ price: 10.005, date: 'x' }, { price: 10, date: 'y' }] } };
    const result = summarisePricing(pricing);
    expect(result.avgPrice).toBe(10); // (10.005 + 10)/2 = 10.0025 → 10.00
  });
});

// ─── summarisePricingAud ────────────────────────────────────────────────────────

describe('summarisePricingAud', () => {
  it('returns null when there is nothing to summarise', async () => {
    const { summarisePricingAud } = await load();
    expect(await summarisePricingAud(null)).toBeNull();
  });

  it('converts USD aggregates to AUD and includes the fx rate', async () => {
    mockGetRate.mockResolvedValue(1.5);
    const { summarisePricingAud } = await load();
    const pricing = { raw: { records: [{ price: 10, date: '2026-01-01' }, { price: 30, date: '2026-01-02' }] } };
    const result = await summarisePricingAud(pricing);

    expect(result.currency).toBe('AUD');
    expect(result.fxRate).toBe(1.5);
    expect(result.avgPrice).toBe(30);   // 20 * 1.5
    expect(result.minPrice).toBe(15);   // 10 * 1.5
    expect(result.maxPrice).toBe(45);   // 30 * 1.5
    expect(result.lastSalePrice).toBe(45); // newest (30) * 1.5
  });
});

// ─── getSegmentName + getCardSightClient ────────────────────────────────────────

describe('getSegmentName', () => {
  it('returns null for a falsy segment id', async () => {
    const { getSegmentName } = await load();
    expect(await getSegmentName(null)).toBeNull();
    expect(mockSegments).not.toHaveBeenCalled();
  });

  it('resolves a segment id to its name and caches the catalog', async () => {
    mockSegments.mockResolvedValue({ data: { segments: [
      { id: 'seg-1', name: 'Pokemon' },
      { id: 'seg-2', name: 'Basketball' },
    ] } });
    const { getSegmentName } = await load();

    expect(await getSegmentName('seg-2')).toBe('Basketball');
    expect(await getSegmentName('seg-1')).toBe('Pokemon');
    // Catalog fetched once, then served from the cached map.
    expect(mockSegments).toHaveBeenCalledTimes(1);
  });

  it('returns null for an unknown segment id', async () => {
    mockSegments.mockResolvedValue({ data: { segments: [{ id: 'seg-1', name: 'Pokemon' }] } });
    const { getSegmentName } = await load();
    expect(await getSegmentName('missing')).toBeNull();
  });

  it('returns null and does not throw when the catalog lookup fails', async () => {
    mockSegments.mockRejectedValue(new Error('catalog down'));
    const { getSegmentName } = await load();
    expect(await getSegmentName('seg-1')).toBeNull();
  });
});

describe('getCardSightClient', () => {
  it('throws when no API key is configured', async () => {
    delete process.env.CARDSIGHT_API_KEY;
    delete process.env.CARDSIGHTAI_API_KEY;
    const { getCardSightClient } = await load();
    expect(() => getCardSightClient()).toThrow(/CardSight API not configured/);
  });

  it('constructs the client once and memoizes it', async () => {
    const { getCardSightClient } = await load();
    const a = getCardSightClient();
    const b = getCardSightClient();
    expect(a).toBe(b);
    expect(CardSightCtor).toHaveBeenCalledTimes(1);
  });
});

// ─── module-load coupling guard ──────────────────────────────────────────────

// Identifying a card touches no database, but this module used to import the FX
// helper statically — and that reaches the backend Supabase client, which throws
// at module load without SUPABASE_SERVICE_ROLE_KEY. A CardSight outage was then
// indistinguishable from a Supabase misconfiguration, and the scoring harness
// couldn't exercise CardSight without a service-role key it has no use for.
//
// This runs in a subprocess on purpose: the mocks at the top of this file
// replace exchangeRates.js, which is exactly the import being guarded, and the
// failure it guards against happens at import time.
describe('module load without a Supabase service-role key', () => {
  it('imports cleanly and reports only the missing CardSight key', () => {
    const moduleUrl = new URL('../../../src/utils/cardSightClient.js', import.meta.url).href;
    const script = `
      const { getCardSightClient } = await import(${JSON.stringify(moduleUrl)});
      try { getCardSightClient(); process.stdout.write('NO_THROW'); }
      catch (err) { process.stdout.write(err.message); }
    `;
    // Empty strings rather than deletes: dotenv/config skips keys already
    // present in process.env, so a local .env can't put them back.
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SUPABASE_SERVICE_ROLE_KEY: '',
        CARDSIGHT_API_KEY: '',
        CARDSIGHTAI_API_KEY: '',
      },
    });

    expect(result.stderr).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/CardSight API not configured/);
  });
});
