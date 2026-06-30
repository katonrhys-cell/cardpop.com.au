import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), auth: { admin: {} } }));

vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import loginRouter from '../../../src/routes/auth/login.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', loginRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: fn => Promise.resolve(result).catch(fn),
  };
  return b;
}

const LOCKED_RECORD = {
  id: 'attempt-1', email: 'test@example.com', ip_address: '1.2.3.4',
  failed_attempts: 5, locked_until: new Date(Date.now() + 600000).toISOString(),
};

const UNLOCKED_RECORD = {
  id: 'attempt-2', email: 'test@example.com', ip_address: '1.2.3.4',
  failed_attempts: 2, locked_until: null,
};

beforeEach(() => vi.clearAllMocks());

// ─── POST /attempt ────────────────────────────────────────────────────────────

describe('POST /attempt', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/attempt').send({ ipAddress: '1.2.3.4' });
    expect(res.status).toBe(400);
  });

  it('does not require a client-supplied ipAddress (derived server-side)', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/attempt').send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
  });

  it('allows when no prior record', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/attempt').send({ email: 'test@example.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
  });

  it('returns 429 when account is locked', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: LOCKED_RECORD, error: null }));
    const res = await request(app).post('/attempt').send({ email: 'test@example.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/locked/i);
    expect(res.body.lockedUntil).toBeDefined();
  });

  it('allows when lock has expired', async () => {
    const expiredRecord = { ...LOCKED_RECORD, locked_until: new Date(Date.now() - 1000).toISOString() };
    mockSupabase.from.mockReturnValue(makeBuilder({ data: expiredRecord, error: null }));
    const res = await request(app).post('/attempt').send({ email: 'test@example.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
  });

  it('allows when failed_attempts is below threshold', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: UNLOCKED_RECORD, error: null }));
    const res = await request(app).post('/attempt').send({ email: 'test@example.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
  });
});

// ─── POST /record-failure ─────────────────────────────────────────────────────

describe('POST /record-failure', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/record-failure').send({ ipAddress: '1.2.3.4' });
    expect(res.status).toBe(400);
  });

  it('inserts new record when none exists', async () => {
    const checkBuilder = makeBuilder({ data: null, error: null });
    const insertBuilder = makeBuilder({ data: null, error: null });
    mockSupabase.from
      .mockReturnValueOnce(checkBuilder)
      .mockReturnValueOnce(insertBuilder);
    const res = await request(app).post('/record-failure').send({ email: 'test@example.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ failed_attempts: 1 }));
  });

  it('increments existing record', async () => {
    const checkBuilder = makeBuilder({ data: UNLOCKED_RECORD, error: null });
    const updateBuilder = makeBuilder({ data: null, error: null });
    mockSupabase.from
      .mockReturnValueOnce(checkBuilder)
      .mockReturnValueOnce(updateBuilder);
    const res = await request(app).post('/record-failure').send({ email: 'test@example.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ failed_attempts: 3 }));
  });
});

// ─── POST /record-success ─────────────────────────────────────────────────────

describe('POST /record-success', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/record-success').send({ ipAddress: '1.2.3.4' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without a bearer token (cannot clear lockout unauthenticated)', async () => {
    const res = await request(app).post('/record-success').send({ email: 'test@example.com' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when the token does not match the email', async () => {
    mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: { email: 'someone@else.com' } }, error: null });
    const res = await request(app)
      .post('/record-success')
      .set('Authorization', 'Bearer tok')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(403);
  });

  it('clears login attempts when the token matches the email', async () => {
    mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: { email: 'test@example.com' } }, error: null });
    const deleteBuilder = makeBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValue(deleteBuilder);
    const res = await request(app)
      .post('/record-success')
      .set('Authorization', 'Bearer tok')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
