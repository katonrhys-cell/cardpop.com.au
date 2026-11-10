import { describe, it, expect, vi, beforeEach } from 'vitest';

// The Local Map's shared geocode cache: cached answers never reach
// Nominatim, misses are looked up (spaced) and stored, transient failures are
// not cached, and a stale "not found" is retried.

const db = vi.hoisted(() => ({ rows: [], upserts: [] }));
vi.mock('../../src/utils/supabaseClient.js', () => ({
  default: {
    from: () => ({
      select: () => ({ in: async (_col, keys) => ({ data: db.rows.filter((r) => keys.includes(r.query_key)), error: null }) }),
      upsert: async (row) => { db.upserts.push(row); return { error: null }; },
    }),
  },
}));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { geocodeQueries, normaliseQueryKey } = await import('../../src/utils/geocodeCache.js');

const nominatim = (body, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => body }));

beforeEach(() => {
  db.rows = [];
  db.upserts = [];
  vi.useFakeTimers({ toFake: ['setTimeout'] });
});

const run = async (p) => { const done = p; await vi.runAllTimersAsync(); return done; };

describe('geocodeQueries', () => {
  it('answers cached queries without calling Nominatim', async () => {
    db.rows = [{ query_key: 'parramatta, nsw', lat: -33.8, lng: 151.0, found: true, geocoded_at: new Date().toISOString() }];
    global.fetch = nominatim([]);
    const out = await run(geocodeQueries(['  Parramatta,  NSW ']));
    expect(out.results).toEqual({ 'parramatta, nsw': [-33.8, 151.0] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('looks up a miss once and stores it', async () => {
    global.fetch = nominatim([{ lat: '-37.81', lon: '144.96' }]);
    const out = await run(geocodeQueries(['Melbourne, VIC']));
    expect(out.results['melbourne, vic']).toEqual([-37.81, 144.96]);
    expect(db.upserts).toHaveLength(1);
    expect(db.upserts[0]).toMatchObject({ query_key: 'melbourne, vic', found: true });
  });

  it('caches a definite "not found" but not a transient failure', async () => {
    global.fetch = nominatim([]);
    const miss = await run(geocodeQueries(['nowhere, nsw']));
    expect(miss.results['nowhere, nsw']).toBeNull();
    expect(db.upserts[0]).toMatchObject({ found: false });

    db.upserts = [];
    global.fetch = nominatim(null, false);
    const failed = await run(geocodeQueries(['somewhere, qld']));
    expect(failed.pending).toEqual(['somewhere, qld']);
    expect(db.upserts).toHaveLength(0);
  });

  it('retries a "not found" older than 30 days', async () => {
    db.rows = [{ query_key: 'newtown, nsw', lat: null, lng: null, found: false, geocoded_at: '2020-01-01T00:00:00Z' }];
    global.fetch = nominatim([{ lat: '-33.9', lon: '151.18' }]);
    const out = await run(geocodeQueries(['Newtown, NSW']));
    expect(out.results['newtown, nsw']).toEqual([-33.9, 151.18]);
  });

  it('leaves misses pending once the time budget is spent', async () => {
    global.fetch = nominatim([{ lat: '1', lon: '2' }]);
    const out = await run(geocodeQueries(['a, nsw', 'b, nsw'], { budgetMs: 0 }));
    expect(out.pending).toEqual(['a, nsw', 'b, nsw']);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('normalises keys the same way the browser does', () => {
    expect(normaliseQueryKey('  12 Main St,   Perth ')).toBe('12 main st, perth');
  });
});
