import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { encrypt } from '../../../src/utils/encryption.js';

const mockPb = vi.hoisted(() => ({
  collection: vi.fn(),
  authStore: { save: vi.fn(), record: { id: 'user-123', email: 'test@example.com' } },
  send: vi.fn(),
}));

vi.mock('../../../src/utils/pocketbaseClient.js', () => ({ default: mockPb }));

import mfaRouter from '../../../src/routes/auth/mfa.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', mfaRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

function makeCollection(overrides = {}) {
  return {
    getFirstListItem: vi.fn().mockResolvedValue(null),
    getOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'rec-1', mfaId: 'mfa_test_123', expiresAt: new Date(Date.now() + 600_000).toISOString() }),
    update: vi.fn().mockResolvedValue({}),
    authWithPassword: vi.fn().mockResolvedValue({ token: 'jwt-tok', record: { id: 'user-1' } }),
    ...overrides,
  };
}

const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.collection.mockReturnValue(makeCollection());
});

// ─── POST /request ────────────────────────────────────────────────────────────

describe('POST /request', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app).post('/request').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId/i);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/request').send({ userId: 'user-1' });
    expect(res.status).toBe(400);
  });

  it('creates an MFA session and returns mfaId and expiresAt', async () => {
    const futureExpiry = new Date(Date.now() + 600_000).toISOString();
    mockPb.collection.mockReturnValue(makeCollection({
      create: vi.fn().mockResolvedValue({ id: 'rec-1', mfaId: 'mfa_abc', expiresAt: futureExpiry }),
    }));
    const res = await request(app).post('/request').send({ userId: 'user-1', email: 'a@b.com' });
    expect(res.status).toBe(200);
    expect(res.body.mfaId).toBe('mfa_abc');
    expect(res.body.expiresAt).toBeDefined();
    expect(res.body.message).toMatch(/otp sent/i);
  });

  it('stores an encrypted OTP in the MFA session record', async () => {
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);
    await request(app).post('/request').send({ userId: 'user-1', email: 'a@b.com' });
    const createCall = col.create.mock.calls[0][0];
    expect(createCall.encryptedOtp).toBeDefined();
    expect(typeof createCall.encryptedOtp).toBe('string');
    expect(createCall.verified).toBe(false);
  });
});

// ─── POST /verify ─────────────────────────────────────────────────────────────

describe('POST /verify', () => {
  it('returns 400 when mfaId is missing', async () => {
    const res = await request(app).post('/verify').send({ code: '12345678' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when code is missing', async () => {
    const res = await request(app).post('/verify').send({ mfaId: 'mfa_123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when code is not 8 digits', async () => {
    const res = await request(app).post('/verify').send({ mfaId: 'mfa_123', code: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 digits/i);
  });

  it('throws when the MFA session is expired', async () => {
    const expiredAt = new Date(Date.now() - 1000).toISOString();
    const encryptedOtp = encrypt({ code: '12345678', expiresAt: expiredAt });
    mockPb.collection.mockReturnValue(makeCollection({
      getFirstListItem: vi.fn().mockResolvedValue({
        id: 's-1', userId: 'user-1', mfaId: 'mfa_123',
        expiresAt: expiredAt,
        encryptedOtp,
      }),
    }));
    const res = await request(app).post('/verify').send({ mfaId: 'mfa_123', code: '12345678' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('throws when the code is wrong', async () => {
    const futureExpiry = new Date(Date.now() + 600_000).toISOString();
    const encryptedOtp = encrypt({ code: '99999999', expiresAt: futureExpiry });
    const user = { id: 'user-1', email: 'a@b.com', password: 'pw' };
    mockPb.collection.mockImplementation((name) => {
      if (name === 'mfaSessions') return makeCollection({
        getFirstListItem: vi.fn().mockResolvedValue({
          id: 's-1', userId: 'user-1', mfaId: 'mfa_123',
          expiresAt: futureExpiry, encryptedOtp,
        }),
        update: vi.fn().mockResolvedValue({}),
      });
      return makeCollection({ getOne: vi.fn().mockResolvedValue(user) });
    });
    const res = await request(app).post('/verify').send({ mfaId: 'mfa_123', code: '12345678' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/invalid mfa code/i);
  });

  it('returns a token on successful verification', async () => {
    const futureExpiry = new Date(Date.now() + 600_000).toISOString();
    const correctCode = '12345678';
    const encryptedOtp = encrypt({ code: correctCode, expiresAt: futureExpiry });
    const user = { id: 'user-1', email: 'a@b.com', password: 'hashedpw' };

    mockPb.collection.mockImplementation((name) => {
      if (name === 'mfaSessions') return makeCollection({
        getFirstListItem: vi.fn().mockResolvedValue({
          id: 's-1', userId: 'user-1', mfaId: 'mfa_123',
          expiresAt: futureExpiry, encryptedOtp,
        }),
        update: vi.fn().mockResolvedValue({}),
      });
      if (name === 'auditLogs') return makeCollection({ create: vi.fn().mockResolvedValue({}) });
      return makeCollection({
        getOne: vi.fn().mockResolvedValue(user),
        update: vi.fn().mockResolvedValue({}),
        authWithPassword: vi.fn().mockResolvedValue({ token: 'final-token', record: user }),
      });
    });

    const res = await request(app).post('/verify').send({ mfaId: 'mfa_123', code: correctCode });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBe('final-token');
  });
});
