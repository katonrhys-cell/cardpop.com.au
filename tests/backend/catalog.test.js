import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockCallEbay = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/ebayClient.js', () => ({ callEbayApi: mockCallEbay }));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

// The resolver checks the card_art_overrides table (via the backend Supabase
// client) before the free APIs. Mock it: default no override; a test can make
// mockMaybeSingle return a row to exercise the override path.
const mockMaybeSingle = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));
// Fixture rows for the internal card_catalogue source (searchInternalCatalogue).
const internalCatalogue = vi.hoisted(() => ({ data: [], error: null }));
vi.mock('../../src/utils/supabaseClient.js', () => {
  // card_catalogue queries build a filter chain and are awaited directly, so
  // the builder returns itself from every method and is thenable.
  const catalogueBuilder = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (onFulfilled, onRejected) =>
          Promise.resolve({ data: internalCatalogue.data, error: internalCatalogue.error }).then(onFulfilled, onRejected);
      }
      return () => catalogueBuilder;
    },
  });
  return {
    default: {
      from: (table) => table === 'card_catalogue'
        ? catalogueBuilder
        : { select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: mockMaybeSingle }) }) }) },
    },
  };
});

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
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  internalCatalogue.data = []; internalCatalogue.error = null;
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

  it('pushes the collector number into the Pokémon query', async () => {
    // Filtering upstream is the point: a name-only search returns an arbitrary
    // page of a card's many printings, and the right one usually isn't in it.
    h.pokemon = [{ id: 'p1', name: 'Charizard', set: { name: 'Base' }, number: '4' }];

    const res = await request(app).get('/search').query({ q: 'Charizard', collection: 'pokemon', number: '4/102' });

    expect(res.status).toBe(200);
    expect(res.body.precise).toBe(true);
    const url = decodeURIComponent(global.fetch.mock.calls[0][0]);
    expect(url).toContain('number:"4"');
  });

  it('pushes the collector number into the Scryfall query', async () => {
    h.scryfall = [{ id: 's1', name: 'Black Lotus', set_name: 'Alpha', collector_number: '232' }];

    await request(app).get('/search').query({ q: 'Black Lotus', collection: 'magic', number: '232' });

    const url = decodeURIComponent(global.fetch.mock.calls[0][0]);
    expect(url).toContain('cn:232');
  });

  it('strips the set total and leading zeros before filtering', async () => {
    h.pokemon = [{ id: 'p1', name: 'Charizard', set: { name: 'Base' }, number: '4' }];

    await request(app).get('/search').query({ q: 'Charizard', collection: 'pokemon', number: '004/102' });

    const url = decodeURIComponent(global.fetch.mock.calls[0][0]);
    expect(url).toContain('number:"4"');
  });

  it('falls back to a name-only search when the number filter finds nothing', async () => {
    // A misread number, or one the upstream stores differently, must degrade to
    // the old behaviour rather than returning an empty result.
    let call = 0;
    global.fetch = vi.fn(() => {
      call += 1;
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: call === 1 ? [] : [{ id: 'p1', name: 'Charizard', set: { name: 'Base' }, number: '4' }] }),
      });
    });

    const res = await request(app).get('/search').query({ q: 'Charizard', collection: 'pokemon', number: '999' });

    expect(res.body.results).toHaveLength(1);
    expect(res.body.precise).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(decodeURIComponent(global.fetch.mock.calls[1][0])).not.toContain('number:');
  });

  it('runs a single name-only pass when no number is supplied', async () => {
    h.pokemon = [{ id: 'p1', name: 'Charizard', set: { name: 'Base' }, number: '4' }];

    const res = await request(app).get('/search').query({ q: 'Charizard', collection: 'pokemon' });

    expect(res.body.precise).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(global.fetch.mock.calls[0][0])).not.toContain('number:');
  });

  it('ignores an unreadable collector number', async () => {
    h.pokemon = [{ id: 'p1', name: 'Charizard', set: { name: 'Base' }, number: '4' }];

    await request(app).get('/search').query({ q: 'Charizard', collection: 'pokemon', number: '---' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(global.fetch.mock.calls[0][0])).not.toContain('number:');
  });

  it('drops an API whose upstream request fails', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) }));
    const res = await request(app).get('/search?q=x&collection=pokemon');
    expect(res.body.results).toEqual([]);
  });

  it('includes confirmed internal catalogue entries alongside the public APIs', async () => {
    h.pokemon = [{ id: 'p1', name: 'Pikachu', set: { name: 'Base' }, number: '25' }];
    internalCatalogue.data = [{
      catalogue_key: 'pokemon|base set|25', collection: 'Pokémon', set_name: 'Base Set',
      insert_name: null, card_number: '25', parallel: null, card_name: 'Pikachu',
      year: '1999', confirmations: 2, observations: 5,
    }];
    const res = await request(app).get('/search?q=Pikachu&collection=pokemon');
    expect(res.body.results.map(r => r.source).sort()).toEqual(['cardpop', 'pokemon-tcg']);
  });

  it('answers sports-card searches from the internal catalogue alone', async () => {
    // No public API covers sports cards; the accumulated CardPop catalogue is
    // the only source that can corroborate this read.
    internalCatalogue.data = [{
      catalogue_key: 'nba basketball|2003-04 topps|221', collection: 'NBA Basketball',
      set_name: '2003-04 Topps', insert_name: null, card_number: '221', parallel: null,
      card_name: 'LeBron James', year: '2003', confirmations: 1, observations: 4,
    }];
    const res = await request(app).get('/search').query({ q: 'LeBron James', collection: 'NBA Basketball', number: '221' });
    expect(res.body.precise).toBe(true);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({
      source: 'cardpop', name: 'LeBron James', setName: '2003-04 Topps',
      cardNumber: '221', year: '2003', insertName: null, collection: 'NBA Basketball',
    });
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

// ─── POST /images ─────────────────────────────────────────────────────────────
// Note: the resolver caches by name|set|collection at module scope, so each test
// uses a distinct card name to avoid cross-test cache bleed.

describe('POST /images', () => {
  it('returns 400 when cards is not an array', async () => {
    const res = await request(app).post('/images').send({ cards: 'nope' });
    expect(res.status).toBe(400);
  });

  it('resolves Pokémon art and echoes the name|set key', async () => {
    h.pokemon = [{ id: 'p9', images: { small: 'http://img/small.png', large: 'http://img/large.png' } }];
    const res = await request(app).post('/images').send({
      cards: [{ name: 'Blastoise ImgOne', set: 'Base Set', collection: 'Pokémon' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([{
      key: 'Blastoise ImgOne|Base Set',
      image: { small: 'http://img/small.png', large: 'http://img/large.png', id: 'p9', source: 'pokemon-tcg' },
    }]);
    // Pokémon collection → only the Pokémon API is queried.
    expect(global.fetch.mock.calls.every(([u]) => String(u).includes('pokemontcg.io'))).toBe(true);
  });

  it('de-duplicates identical cards into a single upstream lookup', async () => {
    h.pokemon = [{ id: 'p10', images: { small: 'http://img/dup.png' } }];
    const res = await request(app).post('/images').send({
      cards: [
        { name: 'Venusaur ImgDup', set: 'Jungle', collection: 'Pokémon' },
        { name: 'Venusaur ImgDup', set: 'Jungle', collection: 'Pokémon' },
      ],
    });
    expect(res.body.results).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns image:null for a card the free APIs do not cover', async () => {
    // NBA collection maps to no adapter → no upstream call, honest null.
    const res = await request(app).post('/images').send({
      cards: [{ name: 'LeBron James ImgMiss', set: '2003-04 Upper Deck', collection: 'NBA' }],
    });
    // apisFor() with an unknown collection tries all three; all miss here.
    expect(res.body.results[0]).toEqual({ key: 'LeBron James ImgMiss|2003-04 Upper Deck', image: null });
  });

  it('resolves Magic art via Scryfall for a magic collection', async () => {
    global.fetch = vi.fn((url) => {
      if (String(url).includes('scryfall.com')) {
        return Promise.resolve({ ok: true, json: async () => ({ id: 's5', image_uris: { small: 'http://s/small.jpg', normal: 'http://s/normal.jpg' } }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });
    const res = await request(app).post('/images').send({
      cards: [{ name: 'Black Lotus ImgMtg', set: 'Alpha', collection: 'Magic: The Gathering' }],
    });
    expect(res.body.results[0].image).toEqual({ small: 'http://s/small.jpg', large: 'http://s/normal.jpg', id: 's5', source: 'scryfall' });
  });

  it('returns an admin override, ahead of the free APIs, for any collection', async () => {
    // NBA is covered by no free API — but an override makes it resolve, and the
    // upstream card APIs are never even queried.
    mockMaybeSingle.mockResolvedValue({ data: { image_url: 'https://cdn.example/lebron.png' }, error: null });
    const res = await request(app).post('/images').send({
      cards: [{ name: 'LeBron James Override', set: '2003-04 Upper Deck', collection: 'NBA' }],
    });
    expect(res.body.results[0].image).toEqual({
      small: 'https://cdn.example/lebron.png',
      large: 'https://cdn.example/lebron.png',
      id: 'override:lebron james override|2003-04 upper deck|nba',
      source: 'override',
    });
    expect(global.fetch).not.toHaveBeenCalled(); // no upstream API lookups
  });

  it('rewrites allowlisted art onto the card-art CDN when CARD_ART_CDN_HOST is set', async () => {
    const SMALL = 'https://images.pokemontcg.io/swsh9/18.png';
    const LARGE = 'https://images.pokemontcg.io/swsh9/18_hires.png';
    h.pokemon = [{ id: 'p20', images: { small: SMALL, large: LARGE } }];
    process.env.CARD_ART_CDN_HOST = 'img.cardpop.com.au';
    try {
      const res = await request(app).post('/images').send({
        cards: [{ name: 'Charizard ImgCdn', set: 'Brilliant Stars', collection: 'Pokémon' }],
      });
      expect(res.body.results[0].image).toEqual({
        small: `https://img.cardpop.com.au/card-art?src=${encodeURIComponent(SMALL)}`,
        large: `https://img.cardpop.com.au/card-art?src=${encodeURIComponent(LARGE)}`,
        id: 'p20',
        source: 'pokemon-tcg',
      });
    } finally {
      delete process.env.CARD_ART_CDN_HOST;
    }
  });
});
