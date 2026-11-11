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
vi.mock('../../src/utils/emailService.js', () => ({ sendOrganiserRequestOutcome: mockSendOutcome }));

import router from '../../src/routes/organiser-requests.js';

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
const ORG_ID = '33333333-3333-4333-8333-333333333333';
const confirmedUser = { id: 'user-1', email: 'maya@example.com', email_confirmed_at: '2026-11-01T00:00:00Z', user_metadata: { full_name: 'Maya Chen' } };

beforeEach(() => {
  vi.clearAllMocks();
  userRef.current = confirmedUser;
  mockAlert.mockResolvedValue({ belled: 1, emailed: true });
});

describe('POST /', () => {
  const body = { organiserName: 'Oz Comic-Con', websiteUrl: 'ozcomiccon.com', message: 'I run it' };

  it('records a pending request and alerts every admin', async () => {
    queue({
      event_organisers: [ok(null)],
      organiser_requests: [ok({ id: REQ_ID, status: 'pending', organiser_name: 'Oz Comic-Con' })],
    });
    const res = await request(app).post('/').send(body);
    expect(res.status).toBe(201);
    const insert = callsOn('organiser_requests', 'insert')[0][1];
    expect(insert).toMatchObject({ user_id: 'user-1', organiser_name: 'Oz Comic-Con', website_url: 'https://ozcomiccon.com/' });
    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ type: 'organiser_request', path: '/admin/organiser-requests' }));
  });

  it('refuses an unconfirmed email', async () => {
    userRef.current = { ...confirmedUser, email_confirmed_at: null };
    const res = await request(app).post('/').send(body);
    expect(res.status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('refuses someone who already owns a page', async () => {
    queue({ event_organisers: [ok({ id: ORG_ID })] });
    expect((await request(app).post('/').send(body)).status).toBe(409);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('refuses to claim a page that already has an owner', async () => {
    queue({ event_organisers: [ok(null), ok({ id: ORG_ID, owner_id: 'someone-else' })] });
    const res = await request(app).post('/').send({ ...body, organiserId: ORG_ID });
    expect(res.status).toBe(409);
  });

  it('answers 409 when a request is already pending (unique index)', async () => {
    queue({
      event_organisers: [ok(null)],
      organiser_requests: [{ data: null, error: { code: '23505', message: 'dup' } }],
    });
    expect((await request(app).post('/').send(body)).status).toBe(409);
  });

  it('rejects a bad link', async () => {
    const res = await request(app).post('/').send({ ...body, websiteUrl: 'not a url' });
    expect(res.status).toBe(400);
  });
});

describe('POST /from-signup', () => {
  it('creates a request from the sign-up choice in the account metadata', async () => {
    userRef.current = { ...confirmedUser, user_metadata: { organiser_interest: true, organiser_name: 'Fast Break Cards' } };
    queue({
      organiser_requests: [{ count: 0, data: null, error: null }, ok({ id: REQ_ID })],
      event_organisers: [ok(null)],
    });
    const res = await request(app).post('/from-signup');
    expect(res.body.created).toBe(true);
    expect(callsOn('organiser_requests', 'insert')[0][1].organiser_name).toBe('Fast Break Cards');
  });

  it('does nothing without the sign-up choice', async () => {
    const res = await request(app).post('/from-signup');
    expect(res.body).toEqual({ created: false });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('never re-creates a request after one was decided', async () => {
    userRef.current = { ...confirmedUser, user_metadata: { organiser_interest: true, organiser_name: 'Fast Break Cards' } };
    queue({ organiser_requests: [{ count: 1, data: null, error: null }], event_organisers: [ok(null)] });
    const res = await request(app).post('/from-signup');
    expect(res.body.created).toBe(false);
    expect(callsOn('organiser_requests', 'insert')).toHaveLength(0);
  });
});

describe('PATCH /admin/:id', () => {
  const pending = { id: REQ_ID, user_id: 'applicant', organiser_name: 'Oz Comic-Con', organiser_id: null, website_url: null, status: 'pending' };

  it('approves by creating the organiser page owned by the applicant', async () => {
    queue({
      organiser_requests: [ok(pending), ok([{ id: REQ_ID }]), ok(null)],
      event_organisers: [ok(null), ok([]), ok({ id: ORG_ID, name: 'Oz Comic-Con', slug: 'oz-comic-con', owner_id: 'applicant' })],
      notifications: [ok(null)],
      profiles: [ok({ email: 'a@example.com', display_name: 'Alex', username: 'alex' })],
    });
    const res = await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'approve' });
    expect(res.status).toBe(200);
    expect(callsOn('event_organisers', 'insert')[0][1]).toMatchObject({ name: 'Oz Comic-Con', owner_id: 'applicant' });
    expect(callsOn('notifications', 'insert')[0][1]).toMatchObject({ user_id: 'applicant', type: 'organiser_approved', link: '/events/organisers/oz-comic-con' });
    expect(mockSendOutcome).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@example.com', approved: true }));
  });

  it('links an existing directory entry instead of duplicating it', async () => {
    queue({
      organiser_requests: [ok(pending), ok([{ id: REQ_ID }]), ok(null)],
      // owned-page lookup (none), the chosen entry, then the owner update
      event_organisers: [ok(null), ok({ id: ORG_ID, name: 'Oz Comic-Con', slug: 'oz-comic-con', owner_id: null }), ok(null)],
      notifications: [ok(null)],
      profiles: [ok({ email: 'a@example.com' })],
    });
    const res = await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'approve', organiserId: ORG_ID });
    expect(res.status).toBe(200);
    expect(callsOn('event_organisers', 'insert')).toHaveLength(0);
    expect(callsOn('event_organisers', 'update')[0][1]).toEqual({ owner_id: 'applicant' });
  });

  it('will not approve onto a page someone else owns', async () => {
    queue({
      organiser_requests: [ok(pending)],
      event_organisers: [ok(null), ok({ id: ORG_ID, name: 'Oz Comic-Con', owner_id: 'other' })],
    });
    const res = await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'approve', organiserId: ORG_ID });
    expect(res.status).toBe(409);
    expect(callsOn('organiser_requests', 'update')).toHaveLength(0);
  });

  it('declines with the reason, and tells the member', async () => {
    queue({
      organiser_requests: [ok(pending), ok([{ id: REQ_ID }])],
      notifications: [ok(null)],
      profiles: [ok({ email: 'a@example.com', display_name: 'Alex' })],
    });
    const res = await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'reject', note: 'Could not find your site' });
    expect(res.status).toBe(200);
    expect(callsOn('notifications', 'insert')[0][1]).toMatchObject({ type: 'organiser_rejected', body: 'Could not find your site' });
    expect(mockSendOutcome).toHaveBeenCalledWith(expect.objectContaining({ approved: false, note: 'Could not find your site' }));
  });

  it('requires a reason to decline', async () => {
    expect((await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'reject' })).status).toBe(400);
  });

  it('refuses a request that was already decided', async () => {
    queue({ organiser_requests: [ok({ ...pending, status: 'approved' })] });
    expect((await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'reject', note: 'x' })).status).toBe(409);
  });

  it('answers 409 when another admin decided it first', async () => {
    queue({ organiser_requests: [ok(pending), ok([])] });
    expect((await request(app).patch(`/admin/${REQ_ID}`).send({ action: 'reject', note: 'x' })).status).toBe(409);
  });
});
