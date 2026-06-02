import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockPb = vi.hoisted(() => ({
  collection: vi.fn(),
  authStore: { save: vi.fn(), record: { id: 'user-123', email: 'test@example.com' } },
  send: vi.fn(),
}));

const mockGenerateBackupCodes = vi.hoisted(() => vi.fn());
const mockEncrypt = vi.hoisted(() => vi.fn());
const mockDecrypt = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/pocketbaseClient.js', () => ({ default: mockPb }));
vi.mock('../../../src/middleware/auth.js', () => ({
  authMiddleware: (req, res, next) => {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    req.user = { id: 'user-123', email: 'test@example.com' };
    next();
  },
}));
vi.mock('../../../src/utils/supabaseClient.js', () => ({ supabase: {}, default: {} }));
vi.mock('../../../src/utils/otpGenerator.js', () => ({ generateBackupCodes: mockGenerateBackupCodes }));
vi.mock('../../../src/utils/encryption.js', () => ({ encrypt: mockEncrypt, decrypt: mockDecrypt }));
vi.mock('../../../src/utils/logger.js', () => ({ default: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import backupCodesRouter from '../../../src/routes/auth/backup-codes.js';

const AUTH = { Authorization: 'Bearer test-token' };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', backupCodesRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

function makeCollection(overrides = {}) {
  return {
    getOne: vi.fn().mockResolvedValue({ id: 'user-123', backupCodes: 'encrypted-payload' }),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

const MOCK_CODES = ['CODE1AB', 'CODE2CD', 'CODE3EF', 'CODE4GH', 'CODE5IJ', 'CODE6KL'];

const DECRYPTED_PAYLOAD = {
  codes: [
    { code: 'CODE1AB', used: false },
    { code: 'CODE2CD', used: true },
  ],
  generatedAt: '2024-01-01T00:00:00.000Z',
};

const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.authStore.record = { id: 'user-123', email: 'test@example.com' };
  mockPb.collection.mockReturnValue(makeCollection());
  mockGenerateBackupCodes.mockReturnValue(MOCK_CODES);
  mockEncrypt.mockReturnValue('encrypted-payload');
  mockDecrypt.mockReturnValue(DECRYPTED_PAYLOAD);
});

// ─── POST /generate ───────────────────────────────────────────────────────────

describe('POST /generate', () => {
  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).post('/generate');
    expect(res.status).toBe(401);
  });

  it('returns 200 with the generated codes', async () => {
    const res = await request(app).post('/generate').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.codes).toEqual(MOCK_CODES);
  });

  it('calls generateBackupCodes with count 6', async () => {
    await request(app).post('/generate').set(AUTH);
    expect(mockGenerateBackupCodes).toHaveBeenCalledWith(6);
  });

  it('encrypts the code payload and persists it on the user record', async () => {
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);
    await request(app).post('/generate').set(AUTH);
    expect(mockEncrypt).toHaveBeenCalledOnce();
    expect(col.update).toHaveBeenCalledWith('user-123', { backupCodes: 'encrypted-payload' });
  });

  it('marks every generated code as unused in the encrypted payload', async () => {
    await request(app).post('/generate').set(AUTH);
    const encryptArg = mockEncrypt.mock.calls[0][0];
    expect(encryptArg.codes.every(c => c.used === false)).toBe(true);
  });

  it('includes a message about secure storage', async () => {
    const res = await request(app).post('/generate').set(AUTH);
    expect(res.body.message).toMatch(/secure location/i);
  });
});

// ─── POST /verify ─────────────────────────────────────────────────────────────

describe('POST /verify', () => {
  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).post('/verify').send({ code: 'CODE1AB' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when code is missing', async () => {
    const res = await request(app).post('/verify').send({}).set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/backup code is required/i);
  });

  it('throws when the user has no backup codes stored', async () => {
    mockPb.collection.mockReturnValue(makeCollection({
      getOne: vi.fn().mockResolvedValue({ id: 'user-123', backupCodes: null }),
    }));
    const res = await request(app).post('/verify').send({ code: 'CODE1AB' }).set(AUTH);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/no backup codes/i);
  });

  it('throws for a code that has already been used', async () => {
    // CODE2CD is marked used: true in DECRYPTED_PAYLOAD
    const res = await request(app).post('/verify').send({ code: 'CODE2CD' }).set(AUTH);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/invalid or already used/i);
  });

  it('throws for a code that does not exist at all', async () => {
    const res = await request(app).post('/verify').send({ code: 'NOTEXIST' }).set(AUTH);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/invalid or already used/i);
  });

  it('verifies a valid unused code and returns success', async () => {
    const res = await request(app).post('/verify').send({ code: 'CODE1AB' }).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('marks the verified code as used before re-encrypting', async () => {
    await request(app).post('/verify').send({ code: 'CODE1AB' }).set(AUTH);
    const encryptArg = mockEncrypt.mock.calls[0][0];
    const code1 = encryptArg.codes.find(c => c.code === 'CODE1AB');
    expect(code1.used).toBe(true);
  });

  it('persists the updated codes on the user record', async () => {
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);
    await request(app).post('/verify').send({ code: 'CODE1AB' }).set(AUTH);
    expect(col.update).toHaveBeenCalledWith('user-123', { backupCodes: 'encrypted-payload' });
  });
});
