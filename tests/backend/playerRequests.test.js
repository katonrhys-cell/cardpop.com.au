import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockAlert = vi.hoisted(() => vi.fn());
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

import router from '../../src/routes/player-requests.js';

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
const ok = (data, extra = {}) => ({ data, error: null, ...extra });
const callsOn = (table, method) => builders
  .filter((x) => x.table === table).flatMap((x) => x.b.calls.filter((c) => c[0] === method));

const REQ_ID = '22222222-2222-4222-8222-222222222222';
const confirmedUser = { id: 'user-1', email: 'maya@example.com', email_confirmed_at: '2026-11-01T00:00:00Z', user_metadata: { full_name: 'Maya Chen' } };
const body = { name: 'Dyson Daniels', sport: 'NBA', team: 'Atlanta Hawks', referenceUrl: 'nba.com/player/dyson', note: 'Aussie rookie' };

beforeEach(() => {
  vi.clearAllMocks();
  userRef.current = confirmedUser;
  mockAlert.mockResolvedValue({ belled: 1, emailed: true });
});

describe('POST /', () => {
  it('records a pending request and bells + emails every admin', async () => {
    queue({
      players: [ok([])],
      player_requests: [ok(null, { count: 0 }), ok({ id: REQ_ID, status: 'pending', name: 'Dyson Daniels' })],
    });
    const res = await request(app).post('/').send(body);
    expect(res.status).toBe(201);
    expect(callsOn('player_requests', 'insert')[0][1]).toMatchObject({
      user_id: 'user-1', name: 'Dyson Daniels', sport: 'NBA', reference_url: 'https://nba.com/player/dyson',
    });
    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({
      type: 'player_request', path: '/admin/players', relatedId: REQ_ID,
      email: expect.objectContaining({ subject: 'Player request: Dyson Daniels (NBA)' }),
    }));
  });

  it('refuses an unconfirmed email', async () => {
    userRef.current = { ...confirmedUser, email_confirmed_at: null };
    const res = await request(app).post('/').send(body);
    expect(res.status).toBe(403);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('points at the existing player instead of queueing a duplicate', async () => {
    queue({ players: [ok([{ id: 'p1', slug: 'dyson-daniels', name: 'Dyson Daniels', sport: 'NBA', aliases: [] }])] });
    const res = await request(app).post('/').send(body);
    expect(res.status).toBe(409);
    expect(res.body.player.slug).toBe('dyson-daniels');
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('caps pending requests per member', async () => {
    queue({ players: [ok([])], player_requests: [ok(null, { count: 5 })] });
    const res = await request(app).post('/').send(body);
    expect(res.status).toBe(429);
  });

  it('validates the body', async () => {
    const res = await request(app).post('/').send({ name: 'D', sport: '' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /admin/:id', () => {
  const pending = { id: REQ_ID, user_id: 'user-9', name: 'Dyson Daniels', sport: 'NBA', team: 'Atlanta Hawks', status: 'pending' };

  it('approve creates an unpublished draft and tells the member', async () => {
    queue({
      player_requests: [ok(pending), ok([{ id: REQ_ID }]), ok(null)],
      players: [ok(null), ok({ id: 'new-p', slug: 'dyson-daniels', name: 'Dyson Daniels' })],
      notifications: [ok(null)],
    });
    const res = await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'approve' });
    expect(res.status).toBe(200);
    expect(callsOn('players', 'insert')[0][1]).toMatchObject({ slug: 'dyson-daniels', is_published: false });
    expect(callsOn('notifications', 'insert')[0][1]).toMatchObject({ user_id: 'user-9', type: 'player_request_approved' });
  });

  it('decline needs a reason', async () => {
    const res = await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'reject' });
    expect(res.status).toBe(400);
  });

  it('refuses a request that was already decided', async () => {
    queue({ player_requests: [ok({ ...pending, status: 'approved' })] });
    const res = await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'reject', note: 'No' });
    expect(res.status).toBe(409);
  });
});
