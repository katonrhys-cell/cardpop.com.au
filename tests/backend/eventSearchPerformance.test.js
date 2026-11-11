import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockRun = vi.hoisted(() => vi.fn());
const mockConfigured = vi.hoisted(() => vi.fn());
const userRef = vi.hoisted(() => ({ id: 'owner-1' }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: userRef.id }; next(); },
}));
vi.mock('../../src/utils/searchConsoleClient.js', () => ({
  runSearchAnalytics: mockRun,
  isSearchConsoleConfigured: mockConfigured,
}));

import eventsRouter from '../../src/routes/events.js';
import { searchWindow, eventPageUrl, getEventSearchPerformance, clearEventSearchCache } from '../../src/services/eventSearchPerformance.js';

const app = express();
app.use(express.json());
app.use('/', eventsRouter);

const ID = '11111111-1111-4111-8111-111111111111';
const builder = (result) => {
  const b = new Proxy({}, { get: (_t, p) => (p === 'then' ? (res, rej) => Promise.resolve(result).then(res, rej) : () => b) });
  return b;
};
const event = (over = {}) => ({ data: { id: ID, slug: 'oz-comic-con-2027', status: 'approved', organiser_id: 'owner-1', ...over }, error: null });

beforeEach(() => {
  vi.clearAllMocks();
  userRef.id = 'owner-1';
  mockConfigured.mockReturnValue(true);
  mockSupabase.from.mockImplementation(() => builder(event()));
});

describe('GET /:id/search-performance', () => {
  it('returns the page’s totals and top queries for its organiser', async () => {
    mockRun
      .mockResolvedValueOnce({ rows: [{ keys: [], clicks: 42, impressions: 1200, ctr: 0.035, position: 8.234 }] })
      .mockResolvedValueOnce({ rows: [{ keys: ['oz comic con adelaide'], clicks: 30, impressions: 400, position: 3.04 }] });
    const res = await request(app).get(`/${ID}/search-performance`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      available: true, pageUrl: 'https://cardpop.com.au/events/oz-comic-con-2027',
      clicks: 42, impressions: 1200, ctr: 0.035, position: 8.2,
      queries: [{ query: 'oz comic con adelaide', clicks: 30, impressions: 400, position: 3 }],
    });
    const [totalsReq, queriesReq] = mockRun.mock.calls.map((c) => c[0]);
    expect(totalsReq.dimensionFilterGroups[0].filters[0]).toEqual({
      dimension: 'page', operator: 'equals', expression: 'https://cardpop.com.au/events/oz-comic-con-2027',
    });
    expect(queriesReq.dimensions).toEqual(['query']);
  });

  it('reports zeros (and no position) for a page Google hasn’t shown yet', async () => {
    mockRun.mockResolvedValue({});
    const res = await request(app).get(`/${ID}/search-performance`);
    expect(res.body).toMatchObject({ available: true, clicks: 0, impressions: 0, position: null, queries: [] });
  });

  it('refuses anyone who isn’t the event’s organiser, without asking Google', async () => {
    userRef.id = 'someone-else';
    const res = await request(app).get(`/${ID}/search-performance`);
    expect(res.status).toBe(403);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('says not available for an event that isn’t live, without asking Google', async () => {
    mockSupabase.from.mockImplementation(() => builder(event({ status: 'pending_review' })));
    const res = await request(app).get(`/${ID}/search-performance`);
    expect(res.body).toEqual({ available: false, reason: 'not_live' });
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('answers 503 while Search Console isn’t configured, 502 when Google fails, 404/400 otherwise', async () => {
    mockConfigured.mockReturnValue(false);
    expect((await request(app).get(`/${ID}/search-performance`)).status).toBe(503);
    mockConfigured.mockReturnValue(true);
    mockRun.mockRejectedValue(new Error('boom'));
    expect((await request(app).get(`/${ID}/search-performance`)).status).toBe(502);
    mockSupabase.from.mockImplementation(() => builder({ data: null, error: null }));
    expect((await request(app).get(`/${ID}/search-performance`)).status).toBe(404);
    expect((await request(app).get('/not-a-uuid/search-performance')).status).toBe(400);
  });
});

describe('window + url helpers', () => {
  it('is the 28 days ending two days before today', () => {
    expect(searchWindow(new Date('2026-11-11T10:00:00Z'))).toEqual({ startDate: '2026-10-13', endDate: '2026-11-09' });
  });
  it('falls back to the id when an event has no slug', () => {
    expect(eventPageUrl({ id: ID })).toBe(`https://cardpop.com.au/events/${ID}`);
  });
});

describe('caching', () => {
  const ev = { id: ID, slug: 'oz-comic-con-2027' };
  const NOW = new Date('2026-11-11T10:00:00Z');

  it('asks Search Console once per page per window, not on every open', async () => {
    process.env.EVENT_SEARCH_CACHE_TTL_MS = '60000';
    clearEventSearchCache();
    mockRun.mockResolvedValue({ rows: [{ keys: [], clicks: 1, impressions: 10, ctr: 0.1, position: 2 }] });
    try {
      await getEventSearchPerformance(ev, NOW);
      await getEventSearchPerformance(ev, NOW);
      expect(mockRun).toHaveBeenCalledTimes(2);                       // totals + queries, once
      await getEventSearchPerformance({ id: 'other', slug: 'another-show' }, NOW);
      expect(mockRun).toHaveBeenCalledTimes(4);                       // a different page is its own entry
    } finally {
      process.env.EVENT_SEARCH_CACHE_TTL_MS = '0';
      clearEventSearchCache();
    }
  });

  it('does not cache a failure', async () => {
    process.env.EVENT_SEARCH_CACHE_TTL_MS = '60000';
    clearEventSearchCache();
    mockRun.mockRejectedValueOnce(new Error('google down')).mockResolvedValue({ rows: [] });
    try {
      await expect(getEventSearchPerformance(ev, NOW)).rejects.toThrow('google down');
      await expect(getEventSearchPerformance(ev, NOW)).resolves.toMatchObject({ impressions: 0 });
    } finally {
      process.env.EVENT_SEARCH_CACHE_TTL_MS = '0';
      clearEventSearchCache();
    }
  });
});
