import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const state = vi.hoisted(() => ({ files: [], clientThrows: false }));
const mockClient = vi.hoisted(() => ({}));
const mockGetClient = vi.hoisted(() => vi.fn());
const mockSummarise = vi.hoisted(() => vi.fn());
const mockGetSegmentName = vi.hoisted(() => vi.fn());
const mockGetSegments = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/cardSightClient.js', () => ({
  getCardSightClient: mockGetClient,
  summarisePricingAud: mockSummarise,
  getSegmentName: mockGetSegmentName,
}));
// Mirror the SDK's real match-classification semantics — the route's ranking is
// built on them, so stubbing them to vi.fn() would make the ordering tests vacuous.
vi.mock('cardsightai', () => ({
  getHighestConfidenceDetection: vi.fn(),
  isExactMatch: (d) => d?.card?.id !== undefined,
  isSetLevelMatch: (d) => d?.card?.id === undefined && d?.card?.setId !== undefined,
  hasGrading: vi.fn(), hasParallel: vi.fn(), getParallelInfo: vi.fn(), getFieldValue: vi.fn(),
}));
vi.mock('../../src/utils/collectionSegmentMap.js', () => ({ getSegmentsForCollection: mockGetSegments }));
vi.mock('../../src/utils/marketDataService.js', () => ({ refreshCardMarketData: vi.fn().mockResolvedValue({}) }));
vi.mock('../../src/utils/supabaseClient.js', () => ({ default: { from: vi.fn() }, supabase: { from: vi.fn() } }));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../src/middleware/file-upload.js', () => ({ uploadFiles: () => (req, _res, next) => { req.files = state.files; next(); } }));
vi.mock('../../src/middleware/supabase-auth.js', () => ({ supabaseAuth: (req, _res, next) => { req.userId = 'u1'; next(); } }));
vi.mock('../../src/middleware/auth.js', () => ({ authMiddleware: (req, _res, next) => { req.user = { id: 'u1' }; next(); } }));
vi.mock('../../src/middleware/integrated-ai-rate-limit.js', () => ({ integratedAiRateLimit: (_req, _res, next) => next() }));

import cardsightRouter from '../../src/routes/cardsight.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', cardsightRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  state.files = [{ originalname: 'card.jpg', buffer: Buffer.from('x'), mimetype: 'image/jpeg' }];
  mockClient.pricing = { get: vi.fn() };
  mockClient.catalog = { search: vi.fn(), cards: { get: vi.fn() } };
  mockClient.marketplace = { get: vi.fn() };
  mockClient.identify = { cardBySegment: vi.fn() };
  mockGetClient.mockReturnValue(mockClient);
  process.env.CARDSIGHT_API_KEY = 'cskey_abcdef123';
});

// ─── GET /status ──────────────────────────────────────────────────────────────

describe('GET /status', () => {
  it('reports ok with a key prefix when configured', async () => {
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, keyConfigured: true });
    expect(res.body.keyPrefix).toBe('cskey_...');
  });

  it('reports 500 when the key is missing', async () => {
    delete process.env.CARDSIGHT_API_KEY;
    delete process.env.CARDSIGHTAI_API_KEY;
    const res = await request(app).get('/status');
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });
});

// ─── GET /pricing/:cardId ─────────────────────────────────────────────────────

describe('GET /pricing/:cardId', () => {
  it('returns flattened pricing aggregates', async () => {
    mockClient.pricing.get.mockResolvedValue({ data: { raw: {} } });
    mockSummarise.mockResolvedValue({
      avgPrice: 100, minPrice: 50, maxPrice: 150, salesCount: 8,
      lastSalePrice: 120, lastSaleDate: '2026-01-01', currency: 'AUD',
    });
    const res = await request(app).get('/pricing/card-1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ card_id: 'card-1', avg_price: 100, count: 8, last_sale_price: 120 });
  });

  it('returns null aggregates when there is no pricing', async () => {
    mockClient.pricing.get.mockResolvedValue({ data: null });
    mockSummarise.mockResolvedValue(null);
    const res = await request(app).get('/pricing/card-1');
    expect(res.body).toMatchObject({ avg_price: null, count: 0, currency: 'AUD' });
  });

  it('forwards valid query filters and drops an invalid listing_type', async () => {
    mockClient.pricing.get.mockResolvedValue({ data: {} });
    mockSummarise.mockResolvedValue(null);
    await request(app).get('/pricing/card-1?parallel_id=p1&grade_id=g1&period=30d&listing_type=banana');
    expect(mockClient.pricing.get).toHaveBeenCalledWith('card-1', { parallel_id: 'p1', grade_id: 'g1', period: '30d' });

    await request(app).get('/pricing/card-1?listing_type=auction');
    expect(mockClient.pricing.get).toHaveBeenLastCalledWith('card-1', { listing_type: 'auction' });
  });
});

// ─── GET /autocomplete & /catalog/search ──────────────────────────────────────

describe('GET /autocomplete', () => {
  it('returns 400 without a query', async () => {
    const res = await request(app).get('/autocomplete');
    expect(res.status).toBe(400);
  });

  it('returns card search results', async () => {
    mockClient.catalog.search.mockResolvedValue({ data: { results: [{ id: 'c1' }] } });
    const res = await request(app).get('/autocomplete?q=charizard&take=5');
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([{ id: 'c1' }]);
    expect(mockClient.catalog.search).toHaveBeenCalledWith({ q: 'charizard', type: 'card', take: 5 });
  });
});

describe('GET /catalog/search', () => {
  it('returns 400 without a query', async () => {
    const res = await request(app).get('/catalog/search');
    expect(res.status).toBe(400);
  });

  it('returns the raw search payload', async () => {
    mockClient.catalog.search.mockResolvedValue({ data: { results: [], sets: [] } });
    const res = await request(app).get('/catalog/search?q=base&type=set&year=1999');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [], sets: [] });
    expect(mockClient.catalog.search).toHaveBeenCalledWith({ q: 'base', type: 'set', year: '1999' });
  });
});

// ─── GET /marketplace/:cardId ─────────────────────────────────────────────────

describe('GET /marketplace/:cardId', () => {
  it('returns the marketplace payload', async () => {
    mockClient.marketplace.get.mockResolvedValue({ data: { listings: [{ id: 'm1' }] } });
    const res = await request(app).get('/marketplace/card-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ listings: [{ id: 'm1' }] });
  });
});

// ─── POST /identify (guards) ──────────────────────────────────────────────────

describe('POST /identify', () => {
  it('returns 400 when no image is uploaded', async () => {
    state.files = [];
    const res = await request(app).post('/identify');
    expect(res.status).toBe(400);
  });

  it('returns 503 when the CardSight client cannot be initialised', async () => {
    mockGetClient.mockImplementation(() => { throw new Error('CardSight not configured'); });
    const res = await request(app).post('/identify');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ identified: false, apiError: true });
  });

  it('reports no detection when no segment returns a card', async () => {
    mockGetSegments.mockReturnValue(['pokemon']);
    mockClient.identify.cardBySegment.mockResolvedValue({ data: { detections: [], messages: [] } });
    const res = await request(app).post('/identify').field('collection', 'Pokémon');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ identified: false });
    expect(res.body.message).toMatch(/no card detected/i);
  });

  it('skips CardSight entirely for a collection it has no catalog for', async () => {
    // Empty segment list = "CardSight cannot hold this". Querying anyway can
    // only return a card from the wrong hobby, so no API call should be made.
    mockGetSegments.mockReturnValue([]);
    const res = await request(app).post('/identify').field('collection', 'Magic: The Gathering');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ identified: false, unsupportedCollection: true });
    expect(mockClient.identify.cardBySegment).not.toHaveBeenCalled();
  });
});

// ─── POST /identify — cross-segment ranking ───────────────────────────────────
// When no collection is given the route fans out across every segment, and each
// segment answers with its best guess *within that segment*. Ranking has to be
// explicit: the SDK's confidence-enum-only sort left ties to be decided by the
// fan-out array order, so sports segments beat pokemon on every tie.

const detection = (card, confidence) => ({ card, confidence });

/** Route `cardBySegment(segment, image)` calls to per-segment detection lists. */
function mockSegments(bySegment) {
  mockGetSegments.mockReturnValue(Object.keys(bySegment));
  mockClient.identify.cardBySegment.mockImplementation((seg) =>
    Promise.resolve({ data: { detections: bySegment[seg] ?? [], messages: [] } })
  );
}

describe('POST /identify — cross-segment ranking', () => {
  beforeEach(() => {
    mockGetSegmentName.mockImplementation(async (id) => id ?? null);
    mockClient.catalog.cards.get.mockResolvedValue({ data: null });
    mockClient.pricing.get.mockResolvedValue({ data: null });
    mockSummarise.mockResolvedValue(null);
  });

  it('prefers an exact match over a set-level match from an earlier segment', async () => {
    mockSegments({
      basketball: [detection({ setId: 'nba-set', setName: 'Hoops', segmentId: 'basketball' }, 'High')],
      pokemon:    [detection({ id: 'pk-1', name: 'Charizard', setName: 'Base Set', segmentId: 'pokemon' }, 'High')],
    });

    const res = await request(app).post('/identify');
    expect(res.status).toBe(200);
    expect(res.body.identified).toBe(true);
    expect(res.body.card.name).toBe('Charizard');
    expect(res.body.exactMatch).toBe(true);
  });

  it('prefers a higher confidence tier among equally specific matches', async () => {
    mockSegments({
      basketball: [detection({ id: 'nba-1', name: 'Wrong Player', segmentId: 'basketball' }, 'Low')],
      pokemon:    [detection({ id: 'pk-1', name: 'Charizard', segmentId: 'pokemon' }, 'High')],
    });

    const res = await request(app).post('/identify');
    expect(res.body.card.name).toBe('Charizard');
    expect(res.body.confidence).toBe('High');
  });

  it('normalises the confidence enum into a numeric score and label', async () => {
    mockSegments({
      pokemon: [detection({ id: 'pk-1', name: 'Charizard', segmentId: 'pokemon' }, 'Medium')],
    });

    const res = await request(app).post('/identify');
    // The enum must never reach the client as the only confidence signal —
    // multiplying it by 100 is what rendered "NaN%" in the listing form.
    expect(res.body.confidenceLabel).toBe('Medium');
    expect(res.body.confidenceScore).toBeCloseTo(0.82, 2);
    expect(Number.isNaN(res.body.confidenceScore)).toBe(false);
  });

  it('flags an equally-ranked match from another segment as ambiguous', async () => {
    mockSegments({
      basketball: [detection({ id: 'nba-1', name: 'Some Player', segmentId: 'basketball' }, 'High')],
      pokemon:    [detection({ id: 'pk-1', name: 'Charizard', segmentId: 'pokemon' }, 'High')],
    });

    const res = await request(app).post('/identify');
    expect(res.body.ambiguous).toBe(true);
    expect(res.body.alternatives).toHaveLength(1);
    expect(res.body.alternatives[0]).toMatchObject({ name: 'Charizard', exactMatch: true });
  });

  it('is not ambiguous when the winner outranks every other segment', async () => {
    mockSegments({
      basketball: [detection({ setId: 'nba-set', segmentId: 'basketball' }, 'Low')],
      pokemon:    [detection({ id: 'pk-1', name: 'Charizard', segmentId: 'pokemon' }, 'High')],
    });

    const res = await request(app).post('/identify');
    expect(res.body.ambiguous).toBe(false);
    expect(res.body.card.name).toBe('Charizard');
  });

  it('ignores segments whose lookup rejected and still ranks the rest', async () => {
    mockGetSegments.mockReturnValue(['basketball', 'pokemon']);
    mockClient.identify.cardBySegment.mockImplementation((seg) =>
      seg === 'basketball'
        ? Promise.reject(new Error('segment unavailable'))
        : Promise.resolve({ data: { detections: [detection({ id: 'pk-1', name: 'Charizard', segmentId: 'pokemon' }, 'High')], messages: [] } })
    );

    const res = await request(app).post('/identify');
    expect(res.body.identified).toBe(true);
    expect(res.body.card.name).toBe('Charizard');
  });

  it('caps alternatives and drops duplicates of the winning card', async () => {
    mockSegments({
      pokemon: [
        detection({ id: 'pk-1', name: 'Charizard', segmentId: 'pokemon' }, 'High'),
        detection({ id: 'pk-1', name: 'Charizard', segmentId: 'pokemon' }, 'High'),
        detection({ id: 'pk-2', name: 'Blastoise', segmentId: 'pokemon' }, 'High'),
      ],
    });

    const res = await request(app).post('/identify');
    expect(res.body.card.name).toBe('Charizard');
    expect(res.body.alternatives.map(a => a.name)).toEqual(['Blastoise']);
  });
});
