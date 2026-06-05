import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), auth: { admin: {} } }));

vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next(); },
}));
vi.mock('../../../src/utils/otpGenerator.js', () => ({
  generateOTP: vi.fn().mockReturnValue('87654321'),
  generateBackupCodes: vi.fn().mockReturnValue([]),
}));

const ENCRYPTED_OTP = vi.hoisted(() => 'encrypted-otp-payload');
vi.mock('../../../src/utils/encryption.js', () => ({
  encrypt: vi.fn().mockReturnValue(ENCRYPTED_OTP),
  decrypt: vi.fn().mockReturnValue({ code: '87654321', expiresAt: new Date(Date.now() + 600000).toISOString() }),
}));

import mfaRouter from '../../../src/routes/auth/mfa.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', mfaRouter);
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
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: fn => Promise.resolve(result).catch(fn),
  };
  return b;
}

const MFA_RECORD = {
  id: 'mfa-db-1', user_id: 'user-1', email: 'test@example.com', mfa_id: 'mfa_123',
  encrypted_otp: ENCRYPTED_OTP, expires_at: new Date(Date.now() + 600000).toISOString(), verified: false,
};

beforeEach(() => vi.clearAllMocks());

// ─── POST /request ────────────────────────────────────────────────────────────

describe('POST /request', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app).post('/request').send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/request').send({ userId: 'user-1' });
    expect(res.status).toBe(400);
  });

  it('creates an MFA session and returns mfaId', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/request').send({ userId: 'user-1', email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.mfaId).toBeDefined();
    expect(res.body.expiresAt).toBeDefined();
    expect(res.body.message).toBeDefined();
  });

  it('stores encrypted OTP in mfa_sessions', async () => {
    const b = makeBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValue(b);
    await request(app).post('/request').send({ userId: 'user-1', email: 'test@example.com' });
    expect(b.insert).toHaveBeenCalledWith(expect.objectContaining({ encrypted_otp: ENCRYPTED_OTP, verified: false }));
  });
});

// ─── POST /verify ─────────────────────────────────────────────────────────────

describe('POST /verify', () => {
  it('returns 400 when mfaId is missing', async () => {
    const res = await request(app).post('/verify').send({ code: '87654321' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when code length is not 8', async () => {
    const res = await request(app).post('/verify').send({ mfaId: 'mfa_123', code: '1234' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 digits/i);
  });

  it('verifies a valid OTP and enables MFA', async () => {
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: MFA_RECORD, error: null }))  // fetch mfa_sessions
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))        // update profiles
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))        // update mfa_sessions
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }));       // audit_logs
    const res = await request(app).post('/verify').send({ mfaId: 'mfa_123', code: '87654321' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when code is wrong', async () => {
    const { decrypt } = await import('../../../src/utils/encryption.js');
    decrypt.mockReturnValueOnce({ code: 'WRONGCODE', expiresAt: new Date(Date.now() + 600000).toISOString() });
    mockSupabase.from.mockReturnValue(makeBuilder({ data: MFA_RECORD, error: null }));
    const res = await request(app).post('/verify').send({ mfaId: 'mfa_123', code: '99999999' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/invalid mfa code/i);
  });
});
