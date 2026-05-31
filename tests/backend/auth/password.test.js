import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockPb = vi.hoisted(() => ({
  collection: vi.fn(),
  authStore: { save: vi.fn(), record: { id: 'user-123', email: 'test@example.com' } },
  send: vi.fn(),
}));

vi.mock('../../../src/utils/pocketbaseClient.js', () => ({ default: mockPb }));

import passwordRouter from '../../../src/routes/auth/password.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', passwordRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

function makeCollection(overrides = {}) {
  return {
    getFullList: vi.fn().mockResolvedValue([]),
    getFirstListItem: vi.fn().mockResolvedValue(null),
    getOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'rec-1' }),
    update: vi.fn().mockResolvedValue({ id: 'rec-1' }),
    authWithPassword: vi.fn(),
    ...overrides,
  };
}

const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.collection.mockReturnValue(makeCollection());
});

// ─── POST /validate ───────────────────────────────────────────────────────────

describe('POST /validate', () => {
  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/validate').send({});
    expect(res.status).toBe(400);
  });

  it('reports a weak password correctly', async () => {
    const res = await request(app).post('/validate').send({ password: 'short' });
    expect(res.status).toBe(200);
    expect(res.body.isStrong).toBe(false);
    expect(res.body.missing).toContain('uppercase');
    expect(res.body.missing).toContain('numbers');
    expect(res.body.missing).toContain('specialChars');
  });

  it('reports a strong password correctly', async () => {
    const res = await request(app).post('/validate').send({ password: 'StrongP@ss1' });
    expect(res.status).toBe(200);
    expect(res.body.isStrong).toBe(true);
    expect(res.body.missing).toHaveLength(0);
    expect(res.body.strengthScore).toBe(5);
  });

  it('returns a strength score between 0 and 5', async () => {
    const res = await request(app).post('/validate').send({ password: 'NoSpecial1' });
    expect(res.body.strengthScore).toBeGreaterThanOrEqual(0);
    expect(res.body.strengthScore).toBeLessThanOrEqual(5);
  });
});

// ─── POST /reset/request ──────────────────────────────────────────────────────

describe('POST /reset/request', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/reset/request').send({});
    expect(res.status).toBe(400);
  });

  it('returns success even when user does not exist (prevents enumeration)', async () => {
    mockPb.collection.mockReturnValue(makeCollection({
      getFirstListItem: vi.fn().mockRejectedValue(new Error('Not found')),
    }));
    const res = await request(app).post('/reset/request').send({ email: 'ghost@nowhere.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/if an account exists/i);
  });

  it('creates a reset token and returns success for a valid user', async () => {
    const user = { id: 'user-1', email: 'a@b.com' };
    const col = makeCollection({
      getFirstListItem: vi.fn().mockResolvedValue(user),
      create: vi.fn().mockResolvedValue({ id: 'token-rec-1' }),
    });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).post('/reset/request').send({ email: 'a@b.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Token must NOT be exposed in the response
    expect(res.body.token).toBeUndefined();
  });
});

// ─── POST /reset/verify ───────────────────────────────────────────────────────

describe('POST /reset/verify', () => {
  it('returns 400 when resetToken is missing', async () => {
    const res = await request(app).post('/reset/verify').send({});
    expect(res.status).toBe(400);
  });

  it('throws when the token is not found', async () => {
    mockPb.collection.mockReturnValue(makeCollection({
      getFirstListItem: vi.fn().mockRejectedValue(new Error('Not found')),
    }));
    const res = await request(app).post('/reset/verify').send({ resetToken: 'bogus' });
    expect(res.status).toBe(500);
  });

  it('throws when the token has already been used', async () => {
    mockPb.collection.mockReturnValue(makeCollection({
      getFirstListItem: vi.fn().mockResolvedValue({
        id: 't-1', userId: 'user-1', isUsed: true,
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
      }),
    }));
    const res = await request(app).post('/reset/verify').send({ resetToken: 'used-token' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/already been used/i);
  });

  it('throws when the token has expired', async () => {
    mockPb.collection.mockReturnValue(makeCollection({
      getFirstListItem: vi.fn().mockResolvedValue({
        id: 't-1', userId: 'user-1', isUsed: false,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    }));
    const res = await request(app).post('/reset/verify').send({ resetToken: 'expired-token' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('returns 200 with userId for a valid token', async () => {
    mockPb.collection.mockReturnValue(makeCollection({
      getFirstListItem: vi.fn().mockResolvedValue({
        id: 't-1', userId: 'user-1', isUsed: false,
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
      }),
    }));
    const res = await request(app).post('/reset/verify').send({ resetToken: 'valid-token' });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-1');
  });
});

// ─── POST /reset/complete ─────────────────────────────────────────────────────

describe('POST /reset/complete', () => {
  it('returns 400 when resetToken is missing', async () => {
    const res = await request(app).post('/reset/complete').send({ newPassword: 'StrongP@ss1' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is missing', async () => {
    const res = await request(app).post('/reset/complete').send({ resetToken: 'tok' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the new password is too weak', async () => {
    const res = await request(app).post('/reset/complete').send({ resetToken: 'tok', newPassword: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/strength/i);
    expect(res.body.missing).toBeDefined();
  });

  it('completes the reset for a valid token and strong password', async () => {
    const tokenRecord = {
      id: 't-1', userId: 'user-1', isUsed: false,
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
    };
    const col = makeCollection({
      getFirstListItem: vi.fn().mockResolvedValue(tokenRecord),
      getOne: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com' }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app)
      .post('/reset/complete')
      .send({ resetToken: 'valid-token', newPassword: 'NewStrongP@ss1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Token should be marked used and sessions cleared
    expect(col.update).toHaveBeenCalledWith('t-1', { isUsed: true });
  });
});
