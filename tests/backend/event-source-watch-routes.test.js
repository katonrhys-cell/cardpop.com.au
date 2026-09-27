import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Admin routes that manage an event's weekly website re-scan:
// PUT /watches/:eventId, POST /watches/:eventId/apply, POST /watches/:eventId/dismiss.

const dbHandler = vi.hoisted(() => ({ current: () => ({ data: null, error: null }), writes: [] }));

function makeQuery(table) {
  const state = { table, op: 'select', payload: null };
  const resolve = () => {
    if (state.op !== 'select') dbHandler.writes.push(state);
    return Promise.resolve(dbHandler.current(state));
  };
  const query = {
    select() { return query; },
    update(payload) { state.op = 'update'; state.payload = payload; return query; },
    upsert(payload) { state.op = 'upsert'; state.payload = payload; return query; },
    eq() { return query; },
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

const { default: router } = await import('../../src/routes/event-scan.js');

const app = express();
app.use(express.json());
app.use('/', router);

const EVENT_ID = '11111111-2222-3333-4444-555555555555';
const URL_A = 'https://organiser.example.com/show';

let event;
let watch;

beforeEach(() => {
  dbHandler.writes = [];
  event = { id: EVENT_ID, source_url: URL_A, start_date: '2099-03-01', entry_fee_aud: 0, is_free: true };
  watch = null;
  dbHandler.current = (state) => {
    if (state.op === 'select' && state.table === 'events') return { data: event, error: null };
    if (state.op === 'select' && state.table === 'event_source_watches') return { data: watch, error: null };
    if (state.table === 'event_source_watches') return { data: { ...watch, ...state.payload }, error: null };
    return { data: null, error: null };
  };
});

const writesTo = (table) => dbHandler.writes.filter((w) => w.table === table).map((w) => w.payload);

describe('PUT /watches/:eventId', () => {
  it('creates a watch for a new website and asks for an immediate scan', async () => {
    const res = await request(app).put(`/watches/${EVENT_ID}`).send({ enabled: true });

    expect(res.status).toBe(200);
    expect(res.body.scanNow).toBe(true);
    const [row] = writesTo('event_source_watches');
    expect(row).toMatchObject({ event_id: EVENT_ID, url: URL_A, is_active: true, created_by: 'admin-1' });
    expect(row.next_scan_at).toBeTruthy();
  });

  it('does not rescan when nothing about the watch changed', async () => {
    watch = { event_id: EVENT_ID, url: URL_A, is_active: true, pending_changes: {} };

    const res = await request(app).put(`/watches/${EVENT_ID}`).send({ enabled: true });

    expect(res.body.scanNow).toBe(false);
    expect(writesTo('event_source_watches')[0]).not.toHaveProperty('next_scan_at');
  });

  it('resets comparison state when the website changes', async () => {
    watch = { event_id: EVENT_ID, url: 'https://old.example.com', is_active: true, pending_changes: { start_date: {} } };

    const res = await request(app).put(`/watches/${EVENT_ID}`).send({ enabled: true });

    expect(res.body.scanNow).toBe(true);
    expect(writesTo('event_source_watches')[0]).toMatchObject({ content_hash: null, pending_changes: {}, dismissed_changes: {} });
  });

  it('switches the watch off when disabled or the website is removed', async () => {
    watch = { event_id: EVENT_ID, url: URL_A, is_active: true };
    event.source_url = null;

    const res = await request(app).put(`/watches/${EVENT_ID}`).send({ enabled: true });

    expect(res.body.scanNow).toBe(false);
    expect(writesTo('event_source_watches')).toEqual([expect.objectContaining({ is_active: false })]);
  });

  // Private addresses are refused by safeFetch at scan time; here it's the scheme.
  it('refuses a website that is not http(s)', async () => {
    event.source_url = 'ftp://organiser.example.com/show';

    const res = await request(app).put(`/watches/${EVENT_ID}`).send({ enabled: true });

    expect(res.status).toBe(400);
    expect(writesTo('event_source_watches')).toEqual([]);
  });

  it('validates its input', async () => {
    expect((await request(app).put('/watches/not-a-uuid').send({ enabled: true })).status).toBe(400);
    expect((await request(app).put(`/watches/${EVENT_ID}`).send({ enabled: 'yes' })).status).toBe(400);
  });
});

describe('apply / dismiss', () => {
  beforeEach(() => {
    watch = {
      event_id: EVENT_ID,
      url: URL_A,
      is_active: true,
      pending_changes: {
        start_date: { current: '2099-03-01', found: '2099-03-08' },
        entry_fee_aud: { current: 0, found: 15 },
      },
      dismissed_changes: {},
    };
  });

  it('writes the chosen changes to the event and clears them from pending', async () => {
    const res = await request(app).post(`/watches/${EVENT_ID}/apply`).send({ fields: ['entry_fee_aud'] });

    expect(res.status).toBe(200);
    expect(writesTo('events')).toEqual([{ entry_fee_aud: 15, is_free: false }]);
    expect(writesTo('event_source_watches')[0].pending_changes).toEqual({
      start_date: { current: '2099-03-01', found: '2099-03-08' },
    });
  });

  it('remembers a dismissed value and leaves the event alone', async () => {
    const res = await request(app).post(`/watches/${EVENT_ID}/dismiss`).send({ fields: ['start_date'] });

    expect(res.status).toBe(200);
    expect(writesTo('events')).toEqual([]);
    expect(writesTo('event_source_watches')[0]).toMatchObject({
      dismissed_changes: { start_date: '2099-03-08' },
      pending_changes: { entry_fee_aud: { current: 0, found: 15 } },
    });
  });

  it('refuses a field that has no pending change', async () => {
    const res = await request(app).post(`/watches/${EVENT_ID}/apply`).send({ fields: ['title'] });

    expect(res.status).toBe(400);
    expect(writesTo('events')).toEqual([]);
  });
});
