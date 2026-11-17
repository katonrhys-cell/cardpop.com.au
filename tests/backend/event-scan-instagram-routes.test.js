import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Admin routes that manage the scanner's Instagram sources:
// POST /sources (kind instagram_account), GET /instagram/status,
// POST /instagram/import-organisers.

const dbHandler = vi.hoisted(() => ({ current: () => ({ data: null, error: null }), writes: [] }));

function makeQuery(table) {
  const state = { table, op: 'select', payload: null };
  const resolve = () => {
    if (state.op !== 'select') dbHandler.writes.push(state);
    return Promise.resolve(dbHandler.current(state));
  };
  const query = {
    select() { return query; },
    insert(payload) { state.op = 'insert'; state.payload = payload; return query; },
    upsert(payload, options) { state.op = 'upsert'; state.payload = payload; state.options = options; return query; },
    eq() { return query; },
    not() { return query; },
    order() { return query; },
    limit() { return query; },
    single: resolve,
    maybeSingle: resolve,
    then(onOk, onErr) { return resolve().then(onOk, onErr); },
  };
  return query;
}

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: { from: (t) => makeQuery(t) } }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
  requireAdmin: (_req, _res, next) => next(),
  decodeAal: () => 'aal2',
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'admin-1' }; next(); },
}));

const mockFetchConnectedAccount = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/instagramClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchConnectedAccount: mockFetchConnectedAccount };
});

const { default: router } = await import('../../src/routes/event-scan.js');

const app = express();
app.use(express.json());
app.use('/', router);

const ENV_KEYS = ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID'];
const saved = {};

beforeEach(() => {
  vi.clearAllMocks();
  dbHandler.writes = [];
  dbHandler.current = (state) => {
    if (state.op === 'insert') return { data: { id: 'src-new', ...state.payload }, error: null };
    return { data: null, error: null };
  };
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.INSTAGRAM_ACCESS_TOKEN = 'secret-token';
  process.env.INSTAGRAM_ACCOUNT_ID = '17840000000000000';
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('POST /sources — Instagram accounts', () => {
  it('stores a pasted profile link as the bare handle', async () => {
    const res = await request(app).post('/sources')
      .send({ kind: 'instagram_account', value: 'https://www.instagram.com/CardShowsAU/' });

    expect(res.status).toBe(201);
    expect(dbHandler.writes[0].payload).toMatchObject({ kind: 'instagram_account', value: 'cardshowsau' });
  });

  it('refuses something that is not a handle', async () => {
    const res = await request(app).post('/sources').send({ kind: 'instagram_account', value: 'card shows sydney' });

    expect(res.status).toBe(400);
    expect(dbHandler.writes).toHaveLength(0);
  });

  it('does not let the fixed tagged-posts source be created by hand', async () => {
    const res = await request(app).post('/sources').send({ kind: 'instagram_tagged', value: 'tagged' });

    expect(res.status).toBe(400);
  });
});

describe('GET /instagram/status', () => {
  it('says so when Instagram is not configured, without calling Meta', async () => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;

    const res = await request(app).get('/instagram/status');

    expect(res.body).toEqual({ configured: false });
    expect(mockFetchConnectedAccount).not.toHaveBeenCalled();
  });

  it('names the connected account', async () => {
    mockFetchConnectedAccount.mockResolvedValue({ username: 'cardpop.com.au' });

    const res = await request(app).get('/instagram/status');

    expect(res.body).toEqual({ configured: true, connected: true, username: 'cardpop.com.au' });
  });

  it('passes on why Meta refused the token', async () => {
    mockFetchConnectedAccount.mockRejectedValue(new Error('The Instagram access token has expired'));

    const res = await request(app).get('/instagram/status');

    expect(res.body).toMatchObject({ configured: true, connected: false, error: expect.stringMatching(/expired/) });
    expect(JSON.stringify(res.body)).not.toContain('secret-token');
  });
});

describe('POST /instagram/import-organisers', () => {
  it('adds each organiser account the site knows that is not listed yet', async () => {
    dbHandler.current = (state) => {
      if (state.table === 'event_organisers') {
        return { data: [
          { name: 'Card Shows AU', instagram_url: 'https://www.instagram.com/CardShowsAU/' },
          { name: 'Broken', instagram_url: 'https://example.com/not-instagram' },
        ], error: null };
      }
      if (state.table === 'events') {
        return { data: [
          { organizer_name: 'Card Shows Australia', instagram_url: 'https://instagram.com/cardshowsau' },
          { organizer_name: 'Shire Coll Expo', instagram_url: 'https://www.instagram.com/shirecollexpo/' },
          { organizer_name: 'Known', instagram_url: 'https://www.instagram.com/alreadylisted/' },
        ], error: null };
      }
      if (state.table === 'event_scan_sources' && state.op === 'select') {
        return { data: [{ value: 'alreadylisted' }], error: null };
      }
      if (state.op === 'upsert') return { data: state.payload.map((row, i) => ({ id: `s${i}`, ...row })), error: null };
      return { data: null, error: null };
    };

    const res = await request(app).post('/instagram/import-organisers');

    expect(res.status).toBe(200);
    expect(res.body.added.map((s) => s.value)).toEqual(['cardshowsau', 'shirecollexpo']);
    expect(res.body.added[0]).toMatchObject({ kind: 'instagram_account', label: 'Card Shows AU' });
    expect(res.body.alreadyListed).toBe(1);
    expect(dbHandler.writes[0].options).toMatchObject({ onConflict: 'kind,value', ignoreDuplicates: true });
  });

  it('writes nothing when every account is already listed', async () => {
    dbHandler.current = () => ({ data: [], error: null });

    const res = await request(app).post('/instagram/import-organisers');

    expect(res.body).toEqual({ added: [], alreadyListed: 0 });
    expect(dbHandler.writes).toHaveLength(0);
  });
});
