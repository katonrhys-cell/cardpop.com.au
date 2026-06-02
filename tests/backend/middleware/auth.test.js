import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mock dependencies before importing the middleware ────────────────────────

const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/supabaseClient.js', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { authMiddleware } from '../../../src/middleware/auth.js';

// ─── test app ─────────────────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use(express.json());
  // Protected route that echoes req.user back so we can assert on it
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ user: req.user, hasSupabase: !!req.supabase });
  });
  return app;
}

const app = makeApp();

beforeEach(() => vi.clearAllMocks());

// ─── header validation ────────────────────────────────────────────────────────

describe('authMiddleware — header validation', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing or invalid authorization header/i);
  });

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing or invalid authorization header/i);
  });

  it('returns 401 when Authorization header is just the word "Bearer" with no token', async () => {
    // "Bearer" without a trailing space fails the startsWith('Bearer ') check
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer');
    expect(res.status).toBe(401);
  });

  it('does NOT call supabase.auth.getUser when the header is invalid', async () => {
    await request(app).get('/protected');
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});

// ─── supabase token verification ──────────────────────────────────────────────

describe('authMiddleware — Supabase token verification', () => {
  it('calls supabase.auth.getUser with the extracted Bearer token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    await request(app).get('/protected').set('Authorization', 'Bearer my-token-123');
    expect(mockGetUser).toHaveBeenCalledWith('my-token-123');
  });

  it('returns 401 when Supabase returns an error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired' },
    });
    const res = await request(app).get('/protected').set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired token/i);
  });

  it('returns 401 when Supabase returns no error but user is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await request(app).get('/protected').set('Authorization', 'Bearer anon-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired token/i);
  });

  it('returns 401 when Supabase throws unexpectedly', async () => {
    mockGetUser.mockRejectedValue(new Error('network failure'));
    const res = await request(app).get('/protected').set('Authorization', 'Bearer some-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired token/i);
  });
});

// ─── successful authentication ────────────────────────────────────────────────

describe('authMiddleware — successful authentication', () => {
  const MOCK_USER = { id: 'user-123', email: 'test@example.com', role: 'user' };

  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it('calls next() and returns 200 for a valid token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
  });

  it('attaches the Supabase user object to req.user', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer valid-token');
    expect(res.body.user).toMatchObject({ id: 'user-123', email: 'test@example.com' });
  });

  it('attaches the supabase client to req.supabase', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer valid-token');
    expect(res.body.hasSupabase).toBe(true);
  });
});
