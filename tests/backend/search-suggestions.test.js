import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockGetDidYouMean = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../utils/fuzzyMatch.js', () => ({
  findBestMatches: vi.fn(),
  getDidYouMean: mockGetDidYouMean,
}));

import searchSuggestionsRouter from '../../src/routes/search-suggestions.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', searchSuggestionsRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: [], error: null }) {
  const b = {
    select: vi.fn(() => b), ilike: vi.fn(() => b), or: vi.fn(() => b), eq: vi.fn(() => b), in: vi.fn(() => b),
    limit: vi.fn(() => b), order: vi.fn(() => b),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}
const queueFrom = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDidYouMean.mockReturnValue(null);
});

describe('GET / (search suggestions)', () => {
  it('returns empty suggestions for a query shorter than 2 chars', async () => {
    const res = await request(app).get('/?q=a');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggestions: [], didYouMean: null });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('combines and de-duplicates card and shop product names', async () => {
    queueFrom(
      makeBuilder({ data: [{ card_name: 'Charizard' }, { card_name: 'Charizard' }], error: null }), // vault_items
      makeBuilder({ data: [{ title: 'Charizard GX' }], error: null }),                               // shop_products
      makeBuilder({ data: [], error: null }), // popular fallback (size < 5)
    );
    const res = await request(app).get('/?q=charizard');
    expect(res.status).toBe(200);
    // 'Charizard' appears once despite duplicates across sources.
    expect(res.body.suggestions).toEqual(expect.arrayContaining(['Charizard', 'Charizard GX']));
    expect(res.body.suggestions.filter((s) => s === 'Charizard')).toHaveLength(1);
  });

  it('honours the limit parameter', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ card_name: `Card ${i}` }));
    queueFrom(
      makeBuilder({ data: many, error: null }),
      makeBuilder({ data: [], error: null }),
    );
    const res = await request(app).get('/?q=card&limit=5');
    expect(res.body.suggestions).toHaveLength(5);
  });

  it('offers a "did you mean" when nothing matches', async () => {
    mockGetDidYouMean.mockReturnValue('Charizard');
    queueFrom(
      makeBuilder({ data: [], error: null }),                       // vault_items
      makeBuilder({ data: [], error: null }),                       // shop_products
      makeBuilder({ data: [], error: null }),                       // popular fallback
      makeBuilder({ data: [{ card_name: 'Charizard' }], error: null }), // all cards for fuzzy
    );
    const res = await request(app).get('/?q=charizrd');
    expect(res.body.suggestions).toEqual([]);
    expect(res.body.didYouMean).toBe('Charizard');
    expect(mockGetDidYouMean).toHaveBeenCalledWith('charizrd', ['Charizard'], 0.6);
  });

  it('returns 500 when a query errors', async () => {
    queueFrom(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).get('/?q=charizard');
    expect(res.status).toBe(500);
  });
});
