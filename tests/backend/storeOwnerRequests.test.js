import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockAlert = vi.hoisted(() => vi.fn());
const mockSendOutcome = vi.hoisted(() => vi.fn());
const userRef = vi.hoisted(() => ({ current: null }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = userRef.current; next(); },
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAdmin: (_req, _res, next) => next(),
}));
vi.mock('../../src/services/adminReviewAlerts.js', () => ({ alertAdminsToReview: mockAlert }));
vi.mock('../../src/utils/emailService.js', () => ({ sendStoreOwnerRequestOutcome: mockSendOutcome }));

import router from '../../src/routes/store-owner-requests.js';

const app = express();
app.use(express.json());
app.use('/', router);

function makeBuilder(result) {
  const calls = [];
  const b = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(result).then(res, rej);
      if (prop === 'calls') return calls;
      return (...args) => { calls.push([prop, ...args]); return b; };
    },
  });
  return b;
}

let byTable;
let builders;
function queue(results) {
  byTable = Object.fromEntries(Object.entries(results).map(([t, list]) => [t, [...list]]));
  builders = [];
  mockSupabase.from.mockImplementation((table) => {
    const next = byTable[table]?.shift();
    if (!next) throw new Error(`Unexpected query on ${table}`);
    const b = makeBuilder(next);
    builders.push({ table, b });
    return b;
  });
}
const ok = (data) => ({ data, error: null });
const callsOn = (table, method) => builders
  .filter((x) => x.table === table).flatMap((x) => x.b.calls.filter((c) => c[0] === method));

const REQ_ID = '22222222-2222-4222-8222-222222222222';
const STORE_ID = '33333333-3333-4333-8333-333333333333';
const confirmedUser = { id: 'user-1', email: 'maya@example.com', email_confirmed_at: '2026-11-01T00:00:00Z', user_metadata: { full_name: 'Maya Chen' } };
const store = { id: STORE_ID, slug: 'swap-itt-melbourne', name: 'Swap Itt', suburb: 'Melbourne', city: 'melbourne', state: 'VIC', status: 'approved', owner_id: null };

beforeEach(() => {
  vi.clearAllMocks();
  userRef.current = confirmedUser;
  mockAlert.mockResolvedValue({ belled: 1, emailed: true });
});

describe('POST /', () => {
  const body = { storeId: STORE_ID, roleTitle: 'Owner', websiteUrl: 'swapitt.com.au', message: 'It is my shop' };

  it('records a pending request for the shop and alerts every admin', async () => {
    queue({
      local_game_stores: [ok(store)],
      store_owner_requests: [ok({ id: REQ_ID, status: 'pending', store_id: STORE_ID })],
    });
    const res = await request(app).post('/').send(body);
    expect(res.status).toBe(201);
    expect(callsOn('store_owner_requests', 'insert')[0][1]).toMatchObject({
      user_id: 'user-1', store_id: STORE_ID, role_title: 'Owner', website_url: 'https://swapitt.com.au/',
    });
    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ type: 'store_owner_request', path: '/admin/store-directory' }));
  });

  it('refuses an unconfirmed email', async () => {
    userRef.current = { ...confirmedUser, email_confirmed_at: null };
    expect((await request(app).post('/').send(body)).status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('refuses a shop that already has an owner, is not listed, or is already theirs', async () => {
    queue({ local_game_stores: [ok({ ...store, owner_id: 'someone-else' })] });
    expect((await request(app).post('/').send(body)).status).toBe(409);
    queue({ local_game_stores: [ok({ ...store, status: 'pending' })] });
    expect((await request(app).post('/').send(body)).status).toBe(400);
    queue({ local_game_stores: [ok(null)] });
    expect((await request(app).post('/').send(body)).status).toBe(400);
    queue({ local_game_stores: [ok({ ...store, owner_id: 'user-1' })] });
    expect((await request(app).post('/').send(body)).status).toBe(409);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('answers 409 when a request for the shop is already pending (unique index)', async () => {
    queue({
      local_game_stores: [ok(store)],
      store_owner_requests: [{ data: null, error: { code: '23505', message: 'dup' } }],
    });
    expect((await request(app).post('/').send(body)).status).toBe(409);
  });

  it('needs a shop and a valid link', async () => {
    expect((await request(app).post('/').send({ ...body, storeId: 'nope' })).status).toBe(400);
    expect((await request(app).post('/').send({ ...body, websiteUrl: 'not a url' })).status).toBe(400);
  });
});

describe('GET /me', () => {
  it('returns the member’s requests with their shop, and the shops they own', async () => {
    queue({
      store_owner_requests: [ok([{ id: REQ_ID, store_id: STORE_ID, status: 'pending' }])],
      local_game_stores: [ok([]), ok([store])],
    });
    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
    expect(res.body.requests[0].store.name).toBe('Swap Itt');
    expect(res.body.stores).toEqual([]);
  });
});

describe('PATCH /admin/:id', () => {
  const pending = { id: REQ_ID, user_id: 'user-9', store_id: STORE_ID, status: 'pending' };

  it('approving makes the applicant the shop’s owner and tells them', async () => {
    queue({
      store_owner_requests: [ok(pending), ok([{ id: REQ_ID }])],
      local_game_stores: [ok(store), ok(null)],
      notifications: [ok(null)],
      profiles: [ok({ email: 'owner@example.com', display_name: 'Sam' })],
    });
    const res = await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'approve' });
    expect(res.status).toBe(200);
    expect(callsOn('local_game_stores', 'update')[0][1]).toMatchObject({ owner_id: 'user-9' });
    expect(callsOn('notifications', 'insert')[0][1]).toMatchObject({
      user_id: 'user-9', type: 'store_owner_approved', link: '/card-shops/melbourne/swap-itt-melbourne',
    });
    expect(mockSendOutcome).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@example.com', storeName: 'Swap Itt', approved: true,
      pageUrl: 'https://cardpop.com.au/card-shops/melbourne/swap-itt-melbourne',
    }));
  });

  it('will not approve onto a shop someone else already owns', async () => {
    queue({
      store_owner_requests: [ok(pending)],
      local_game_stores: [ok({ ...store, owner_id: 'another' })],
    });
    expect((await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'approve' })).status).toBe(409);
    expect(callsOn('local_game_stores', 'update')).toHaveLength(0);
  });

  it('declining needs a reason, leaves the shop alone and tells the member why', async () => {
    expect((await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'reject' })).status).toBe(400);
    queue({
      store_owner_requests: [ok(pending), ok([{ id: REQ_ID }])],
      local_game_stores: [ok(store)],
      notifications: [ok(null)],
      profiles: [ok({ email: 'owner@example.com', display_name: 'Sam' })],
    });
    const res = await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'reject', note: 'No link to the shop' });
    expect(res.status).toBe(200);
    expect(callsOn('local_game_stores', 'update')).toHaveLength(0);
    expect(callsOn('notifications', 'insert')[0][1]).toMatchObject({ type: 'store_owner_rejected', body: 'No link to the shop' });
    expect(mockSendOutcome).toHaveBeenCalledWith(expect.objectContaining({ approved: false, note: 'No link to the shop', pageUrl: null }));
  });

  it('refuses a request that was already decided, or decided a moment ago by someone else', async () => {
    queue({ store_owner_requests: [ok({ ...pending, status: 'approved' })] });
    expect((await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'approve' })).status).toBe(409);
    queue({ store_owner_requests: [ok(pending), ok([])], local_game_stores: [ok(store)] });
    expect((await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'approve' })).status).toBe(409);
    expect(callsOn('local_game_stores', 'update')).toHaveLength(0);
  });
});

describe('DELETE /admin/owner/:id', () => {
  it('clears the shop’s owner', async () => {
    queue({ local_game_stores: [ok([{ id: STORE_ID }])] });
    const res = await request(app).delete(`/admin/owner/${STORE_ID}`);
    expect(res.status).toBe(200);
    expect(callsOn('local_game_stores', 'update')[0][1]).toMatchObject({ owner_id: null });
  });
});
