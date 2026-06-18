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
  generateOTP: vi.fn().mockReturnValue('12345678'),
  generateBackupCodes: vi.fn().mockReturnValue(['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5', 'CODE6']),
}));

const ENCRYPTED_CODES = vi.hoisted(() => 'encrypted-codes-payload');
const DECRYPTED = vi.hoisted(() => ({
  codes: [{ code: 'CODE1', used: false }, { code: 'CODE2', used: true }],
  generatedAt: '2026-01-01T00:00:00Z',
}));

vi.mock('../../../src/utils/encryption.js', () => ({
  encrypt: vi.fn().mockReturnValue(ENCRYPTED_CODES),
  decrypt: vi.fn().mockReturnValue(DECRYPTED),
}));

import backupCodesRouter from '../../../src/routes/auth/backup-codes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', backupCodesRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: fn => Promise.resolve(result).catch(fn),
  };
  return b;
}

beforeEach(() => vi.clearAllMocks());

// ─── POST /generate ───────────────────────────────────────────────────────────

describe('POST /generate', () => {
  it('generates backup codes and returns them', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/generate');
    expect(res.status).toBe(200);
    expect(res.body.codes).toEqual(['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5', 'CODE6']);
    expect(res.body.message).toBeDefined();
  });

  it('stores encrypted codes in the profile', async () => {
    const b = makeBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValue(b);
    await request(app).post('/generate');
    expect(b.update).toHaveBeenCalledWith({ backup_codes: ENCRYPTED_CODES });
  });
});

// ─── POST /verify ─────────────────────────────────────────────────────────────

describe('POST /verify', () => {
  it('returns 400 when code is missing', async () => {
    const res = await request(app).post('/verify').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/backup code is required/i);
  });

  it('verifies a valid unused backup code', async () => {
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: { backup_codes: ENCRYPTED_CODES }, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: null, error: null })); // update
    const res = await request(app).post('/verify').send({ code: 'CODE1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 when code is invalid or already used', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: { backup_codes: ENCRYPTED_CODES }, error: null }));
    const res = await request(app).post('/verify').send({ code: 'CODE2' }); // CODE2 is used
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or already used/i);
  });

  it('returns 404 when no backup codes are stored', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: { backup_codes: null }, error: null }));
    const res = await request(app).post('/verify').send({ code: 'CODE1' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no backup codes found/i);
  });
});
