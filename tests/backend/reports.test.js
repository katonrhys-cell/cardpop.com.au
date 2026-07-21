import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockIsAdminUser = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
  requireAdmin: (_req, _res, next) => next(),
  decodeAal: () => 'aal2',
  default: (_req, _res, next) => next(),
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next(); },
  isAdminUser: mockIsAdminUser,
}));
// Make the per-user report limiter a passthrough so tests aren't throttled.
vi.mock('../../src/middleware/endpoint-rate-limit.js', () => ({
  reportLimiter: (_req, _res, next) => next(),
}));

import reportsRouter from '../../src/routes/reports.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/reports', reportsRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn(() => b), insert: vi.fn(() => b), update: vi.fn(() => b),
    eq: vi.fn(() => b), order: vi.fn(() => b), limit: vi.fn(() => b),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (fn) => Promise.resolve(result).catch(fn),
  };
  return b;
}
// The POST handler, after inserting, runs an escalation count query. By default
// queue a low count so escalation doesn't fire in the common-path tests.
const lowEscalationCount = () => makeBuilder({ data: [{ id: 'x' }], error: null });
const queueFrom = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(false);
});

const validReport = { target_type: 'listing', target_id: 'L1', reason: 'counterfeit', details: 'Looks fake' };

// ─── POST /reports ──────────────────────────────────────────────────────────────

describe('POST /reports', () => {
  it('files a report, deriving reporter_id from the token', async () => {
    const dedupe = makeBuilder({ data: null, error: null }); // no existing open report
    const insert = makeBuilder({ data: { id: 'r1', status: 'open', created_at: 'now' }, error: null });
    queueFrom(dedupe, insert, lowEscalationCount());

    const res = await request(app).post('/reports').send(validReport);
    expect(res.status).toBe(201);
    expect(res.body.report).toMatchObject({ id: 'r1', status: 'open' });
    // reporter id comes from the auth token, never the body
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ reporter_id: 'user-1', target_type: 'listing', reason: 'counterfeit' }));
  });

  it('ignores a client-supplied reporter_id', async () => {
    queueFrom(makeBuilder({ data: null }), makeBuilder({ data: { id: 'r1' }, error: null }), lowEscalationCount());
    const res = await request(app).post('/reports').send({ ...validReport, reporter_id: 'someone-else' });
    expect(res.status).toBe(201);
    const insertCall = mockSupabase.from.mock.results[1].value.insert.mock.calls[0][0];
    expect(insertCall.reporter_id).toBe('user-1');
  });

  it('rejects an invalid target_type', async () => {
    const res = await request(app).post('/reports').send({ ...validReport, target_type: 'planet' });
    expect(res.status).toBe(400);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('rejects an invalid reason', async () => {
    const res = await request(app).post('/reports').send({ ...validReport, reason: 'because' });
    expect(res.status).toBe(400);
  });

  it('requires a target_id', async () => {
    const res = await request(app).post('/reports').send({ ...validReport, target_id: undefined });
    expect(res.status).toBe(400);
  });

  it('rejects overly long details', async () => {
    const res = await request(app).post('/reports').send({ ...validReport, details: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('refuses self-reporting a user', async () => {
    const res = await request(app).post('/reports').send({ target_type: 'user', target_id: 'user-1', reason: 'spam' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot report yourself/i);
  });

  it('de-dupes an existing open report with 409', async () => {
    queueFrom(makeBuilder({ data: { id: 'existing' }, error: null }));
    const res = await request(app).post('/reports').send(validReport);
    expect(res.status).toBe(409);
  });

  it('returns 500 on an insert error', async () => {
    queueFrom(makeBuilder({ data: null }), makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).post('/reports').send(validReport);
    expect(res.status).toBe(500);
  });

  it('escalates to admins when a target hits the distinct-report threshold', async () => {
    const notifyBuilder = makeBuilder({ data: null, error: null });
    queueFrom(
      makeBuilder({ data: null }),                                   // dedupe
      makeBuilder({ data: { id: 'r3' }, error: null }),             // insert
      makeBuilder({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], error: null }), // open count = 3 (threshold)
      makeBuilder({ data: [{ id: 'admin-1' }, { id: 'admin-2' }], error: null }),  // admins
      notifyBuilder,                                                 // notification insert
    );
    const res = await request(app).post('/reports').send(validReport);
    expect(res.status).toBe(201);
    // one notification row per admin
    expect(notifyBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ user_id: 'admin-1', type: 'report_escalation' }),
      expect.objectContaining({ user_id: 'admin-2', type: 'report_escalation' }),
    ]);
  });

  it('does not escalate below the threshold', async () => {
    queueFrom(
      makeBuilder({ data: null }),                       // dedupe
      makeBuilder({ data: { id: 'r1' }, error: null }), // insert
      makeBuilder({ data: [{ id: 'a' }], error: null }), // open count = 1
    );
    const res = await request(app).post('/reports').send(validReport);
    expect(res.status).toBe(201);
    // only dedupe, insert, count — no admins/notifications queries
    expect(mockSupabase.from).toHaveBeenCalledTimes(3);
  });
});

// ─── GET /reports (admin) ─────────────────────────────────────────────────────

describe('GET /reports', () => {
  it('rejects non-admins with 403', async () => {
    const res = await request(app).get('/reports');
    expect(res.status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('lists reports for an admin', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    queueFrom(makeBuilder({ data: [{ id: 'r1' }, { id: 'r2' }], error: null }));
    const res = await request(app).get('/reports');
    expect(res.status).toBe(200);
    expect(res.body.reports).toHaveLength(2);
  });

  it('validates the status filter', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    const res = await request(app).get('/reports?status=bogus');
    expect(res.status).toBe(400);
  });

  it('applies a valid status filter', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    const b = makeBuilder({ data: [], error: null });
    queueFrom(b);
    const res = await request(app).get('/reports?status=open');
    expect(res.status).toBe(200);
    expect(b.eq).toHaveBeenCalledWith('status', 'open');
  });
});

// ─── PATCH /reports/:id (admin) ───────────────────────────────────────────────

describe('PATCH /reports/:id', () => {
  it('rejects non-admins with 403', async () => {
    const res = await request(app).patch('/reports/r1').send({ status: 'dismissed' });
    expect(res.status).toBe(403);
  });

  it('updates a report status for an admin and stamps the reviewer', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    const b = makeBuilder({ data: { id: 'r1', status: 'actioned' }, error: null });
    queueFrom(b);
    const res = await request(app).patch('/reports/r1').send({ status: 'actioned', resolution_notes: 'Listing removed' });
    expect(res.status).toBe(200);
    expect(b.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'actioned', reviewed_by: 'user-1' }));
    // a resolving status stamps reviewed_at
    expect(b.update.mock.calls[0][0].reviewed_at).toBeTruthy();
  });

  it('rejects an invalid status', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    const res = await request(app).patch('/reports/r1').send({ status: 'nuke' });
    expect(res.status).toBe(400);
  });
});
