import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// Rate limiter → passthrough so the endpoint logic is exercised in isolation.
vi.mock('../../../src/middleware/endpoint-rate-limit.js', () => ({
  emailCheckLimiter: (_req, _res, next) => next(),
}));

import emailRouter from '../../../src/routes/auth/email.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', emailRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /exists', () => {
  it('returns exists:true when the RPC finds an account', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: true, error: null });
    const res = await request(app).post('/exists').send({ email: 'Taken@Example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: true });
    // Email is normalised (trimmed + lowercased) before the lookup.
    expect(mockSupabase.rpc).toHaveBeenCalledWith('email_has_account', { check_email: 'taken@example.com' });
  });

  it('returns exists:false when no account matches', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: false, error: null });
    const res = await request(app).post('/exists').send({ email: 'new@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: false });
  });

  it('returns 400 for a missing or malformed email', async () => {
    const res = await request(app).post('/exists').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('fails closed (exists:false, no 500) when the RPC errors', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await request(app).post('/exists').send({ email: 'x@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: false });
  });
});
