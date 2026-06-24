import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockCallEbay = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/ebayClient.js', () => ({ callEbayApi: mockCallEbay }));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import catalogRouter from '../../src/routes/catalog.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', catalogRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// Per-host fixtures for the three free card APIs.
const h = { pokemon: [], scryfall: [], yugioh: [] };

beforeEach(() => {
  vi.clearAllMocks();
  h.pokemon = []; h.scryfall = []; h.yugioh = [];
  global.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('pokemontcg.io')) return Promise.resolve({ ok: true, json: async () => ({ data: h.pokemon }) });
    if (u.includes('scryfall.com')) return Promise.resolve({ ok: true, json: async () => ({ data: h.scryfall }) });
    if (u.includes('ygoprodeck.com')) return Promise.resolve({ ok: true, json: async () => ({ data: h.yugioh }) });
    return Promise.resolve({ ok: false, json: async () => ({}) });
  });
});

// ─── GET /search ──────────────────────────────────────────────────────────────

describe('GET /search', () => {
  it('returns 400 without a query', async () => {
    const res = await request(app).get('/search');
    expect(res.status).toBe(400);
  });

  it('searches only the Pokémon API for a pokemon collection and maps results', async () => {
    h.pokemon = [{
      id: 'p1', name: 'Pikachu', set: { name: 'Base', releaseDate: '1999/01/09' },
      number: '25', rarity: 'Common', images: { small: 'http://img/p1.png' },
    }];
    const res = await request(app).get('/search?q=pikachu&collection=pokemon');
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([{
      id: 'p1', name: 'Pikachu', setName: 'Base', year: 1999, cardNumber: '25',
      rarity: 'Common', imageUrl: 'http://img/p1.png', source: 'pokemon-tcg',
    }]);
    // Only the pokemon endpoint was hit.
    expect(global.fetch.mock.calls.every(([u]) => String(u).includes('pokemontcg.io'))).toBe(true);
  });

  it('queries all three APIs when no collection is given', async () => {
    h.pokemon = [{ id: 'p1', name: 'A' }];
    h.scryfall = [{ id: 's1', name: 'B' }];
    h.yugioh = [{ id: 1, name: 'C' }];
    const res = await request(app).get('/search?q=dragon');
    expect(res.body.results.map((r) => r.source).sort()).toEqual(['pokemon-tcg', 'scryfall', 'yugioh-api']);
  });

  it('de-duplicates results by source and id', async () => {
    h.pokemon = [{ id: 'p1', name: 'Dup' }, { id: 'p1', name: 'Dup' }];
    const res = await request(app).get('/search?q=dup&collection=pokemon');
    expect(res.body.results).toHaveLength(1);
  });

  it('drops an API whose upstream request fails', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) }));
    const res = await request(app).get('/search?q=x&collection=pokemon');
    expect(res.body.results).toEqual([]);
  });
});

// ─── GET /autocomplete ────────────────────────────────────────────────────────

describe('GET /autocomplete', () => {
  it('returns empty results for a query shorter than 2 chars', async () => {
    const res = await request(app).get('/autocomplete?q=a');
    expect(res.body).toEqual({ results: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns name/set fields only (no images)', async () => {
    h.pokemon = [{ id: 'p1', name: 'Pikachu', set: { name: 'Base' }, number: '25', images: { small: 'x' } }];
    const res = await request(app).get('/autocomplete?q=pik&collection=pokemon');
    expect(res.body.results[0]).toEqual({ id: 'p1', name: 'Pikachu', setName: 'Base', cardNumber: '25', source: 'pokemon-tcg' });
    expect(res.body.results[0]).not.toHaveProperty('imageUrl');
  });
});

// ─── GET /pricing ─────────────────────────────────────────────────────────────

describe('GET /pricing', () => {
  it('returns 400 without a name', async () => {
    const res = await request(app).get('/pricing');
    expect(res.status).toBe(400);
  });

  it('computes avg/min/max from eBay results in a dual-named envelope', async () => {
    mockCallEbay.mockResolvedValue({ itemSummaries: [
      { price: { value: '100' } }, { price: { value: '200' } }, { price: { value: '0' } },
    ] });
    const res = await request(app).get('/pricing?name=Charizard');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      avgPrice: 150, avg_price: 150, minPrice: 100, maxPrice: 200,
      count: 2, salesCount: 2, currency: 'AUD', source: 'ebay_au',
    });
  });

  it('returns a null envelope when there are no priced results', async () => {
    mockCallEbay.mockResolvedValue({ itemSummaries: [] });
    const res = await request(app).get('/pricing?name=Obscure');
    expect(res.body).toMatchObject({ avgPrice: null, count: 0, currency: 'AUD' });
  });

  it('builds the eBay query from name, set, grading service and grade', async () => {
    mockCallEbay.mockResolvedValue({ itemSummaries: [] });
    await request(app).get('/pricing?name=Charizard&set=Base&grading_service=PSA&grade=10');
    const url = mockCallEbay.mock.calls[0][0];
    const q = new URLSearchParams(url.split('?')[1]).get('q');
    expect(q).toBe('Charizard Base PSA 10');
  });

  it('omits raw/None grading from the query', async () => {
    mockCallEbay.mockResolvedValue({ itemSummaries: [] });
    await request(app).get('/pricing?name=Charizard&grading_service=raw&grade=9');
    const q = new URLSearchParams(mockCallEbay.mock.calls[0][0].split('?')[1]).get('q');
    expect(q).toBe('Charizard');
  });

  it('returns 502 when the eBay call fails', async () => {
    mockCallEbay.mockRejectedValue(new Error('eBay down'));
    const res = await request(app).get('/pricing?name=Charizard');
    expect(res.status).toBe(502);
  });
});
