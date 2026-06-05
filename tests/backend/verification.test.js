import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  auth: {
    admin: {
      getUserById: vi.fn(),
      generateLink: vi.fn(),
    },
  },
}));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import verificationRouter from '../../src/routes/verification.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', verificationRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: fn => Promise.resolve(result).catch(fn),
  };
  return b;
}

const USER = { id: 'user-1', email: 'test@example.com' };

beforeEach(() => vi.clearAllMocks());

// ─── GET /googlee177016f79225570.html ─────────────────────────────────────────

describe('GET /googlee177016f79225570.html', () => {
  it('returns the Google site verification content', async () => {
    const res = await request(app).get('/googlee177016f79225570.html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('google-site-verification');
  });
});

// ─── POST /send-verification-email ───────────────────────────────────────────

describe('POST /send-verification-email', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app).post('/send-verification-email').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when user is not found in Supabase', async () => {
    mockSupabase.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'not found' } });
    const res = await request(app).post('/send-verification-email').send({ userId: 'bad-user' });
    expect(res.status).toBe(404);
  });

  it('returns 500 when generateLink fails', async () => {
    mockSupabase.auth.admin.getUserById.mockResolvedValue({ data: { user: USER }, error: null });
    mockSupabase.auth.admin.generateLink.mockResolvedValue({ error: { message: 'link error' } });
    const res = await request(app).post('/send-verification-email').send({ userId: 'user-1' });
    expect(res.status).toBe(500);
  });

  it('returns success when email is sent', async () => {
    mockSupabase.auth.admin.getUserById.mockResolvedValue({ data: { user: USER }, error: null });
    mockSupabase.auth.admin.generateLink.mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/send-verification-email').send({ userId: 'user-1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── POST /verify-email ───────────────────────────────────────────────────────

describe('POST /verify-email', () => {
  it('returns 400 when token is missing', async () => {
    const res = await request(app).post('/verify-email').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is invalid', async () => {
    const res = await request(app).post('/verify-email').send({ token: 'invalid-token-not-in-store' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });
});

// ─── POST /resend-verification ────────────────────────────────────────────────

describe('POST /resend-verification', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/resend-verification').send({});
    expect(res.status).toBe(400);
  });

  it('always returns success (prevents enumeration)', async () => {
    mockSupabase.auth.admin.generateLink.mockResolvedValue({ error: null });
    const res = await request(app).post('/resend-verification').send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns success even when generateLink fails', async () => {
    mockSupabase.auth.admin.generateLink.mockResolvedValue({ error: { message: 'some error' } });
    const res = await request(app).post('/resend-verification').send({ email: 'unknown@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
