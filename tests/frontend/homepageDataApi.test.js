import { describe, it, expect, vi, beforeEach } from 'vitest';

// lib/homepageData.js reads the home page from the server's edge-cached
// `/public/home` endpoint and falls back, per part, to the direct Supabase
// query. These run the real queryCache so the de-duplication is exercised.

const direct = vi.hoisted(() => ({
  cards: vi.fn(async () => ({ data: [{ id: 'direct-card' }], error: null })),
  sellers: vi.fn(async () => ({ data: [{ id: 'direct-seller' }], error: null })),
  stats: vi.fn(async () => ({ data: { sellers: 1, vaultCards: 2, events: 3 }, error: null })),
  traffic: vi.fn(async () => ({ data: null, error: null })),
}));

vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { tag: 'browser-client' } }));
vi.mock('@/lib/homepageQueries.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    queryFeaturedCards: direct.cards,
    queryFeaturedSellers: direct.sellers,
    queryPlatformStats: direct.stats,
    queryTrafficSummary: direct.traffic,
  };
});

import { clearCache } from '@/lib/queryCache.js';
import { getFeaturedCards, getFeaturedSellers, getPlatformStats, getTrafficSummary } from '@/lib/homepageData.js';
import { PUBLIC_HOME_URL } from '@/lib/publicApi.js';

const bundle = (overrides = {}) => ({
  cards: { data: [{ id: 'api-card' }], error: null },
  sellers: { data: [{ id: 'api-seller' }], error: null },
  stats: { data: { sellers: 10, vaultCards: 200, events: 5 }, error: null },
  traffic: { data: { visitors_30d: 99 }, error: null },
  ...overrides,
});

const fetchOk = (body) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));

beforeEach(() => {
  clearCache();
  for (const fn of Object.values(direct)) fn.mockClear();
});

describe('homepage data via the public endpoint', () => {
  it('serves every part from one fetch and never touches Supabase', async () => {
    globalThis.fetch = fetchOk(bundle());
    const [cards, sellers, stats, traffic] = await Promise.all([
      getFeaturedCards(), getFeaturedSellers(), getPlatformStats(), getTrafficSummary(),
    ]);
    expect(cards).toEqual({ data: [{ id: 'api-card' }], error: null });
    expect(sellers.data[0].id).toBe('api-seller');
    expect(stats.data.vaultCards).toBe(200);
    expect(traffic.data.visitors_30d).toBe(99);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch.mock.calls[0][0]).toBe(PUBLIC_HOME_URL);
    expect(globalThis.fetch.mock.calls[0][1]).toEqual(expect.objectContaining({ credentials: 'omit' }));
    for (const fn of Object.values(direct)) expect(fn).not.toHaveBeenCalled();
  });

  it('falls back to the direct Supabase query when the endpoint is down', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    const cards = await getFeaturedCards();
    expect(cards.data).toEqual([{ id: 'direct-card' }]);
    expect(direct.cards).toHaveBeenCalledTimes(1);
    expect(direct.cards).toHaveBeenCalledWith({ tag: 'browser-client' });
  });

  it('falls back only for the part that failed on the server', async () => {
    globalThis.fetch = fetchOk(bundle({ traffic: { data: null, error: { message: 'nope', code: null } } }));
    const [cards, traffic] = await Promise.all([getFeaturedCards(), getTrafficSummary()]);
    expect(cards.data[0].id).toBe('api-card');
    expect(direct.cards).not.toHaveBeenCalled();
    expect(traffic).toEqual({ data: null, error: null });
    expect(direct.traffic).toHaveBeenCalledTimes(1);
  });

  it('rejects an unexpected body shape and falls back', async () => {
    globalThis.fetch = fetchOk({ unexpected: true });
    const stats = await getPlatformStats();
    expect(stats.data.vaultCards).toBe(2);
    expect(direct.stats).toHaveBeenCalledTimes(1);
  });

  it('survives a thrown fetch', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const sellers = await getFeaturedSellers();
    expect(sellers.data[0].id).toBe('direct-seller');
  });
});
