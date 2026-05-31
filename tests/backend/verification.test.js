import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockPb = vi.hoisted(() => ({
  collection: vi.fn(),
  authStore: { save: vi.fn(), record: null },
  send: vi.fn(),
}));

vi.mock('../../src/utils/pocketbaseClient.js', () => ({ default: mockPb }));

import verificationRouter, { storeToken } from '../../src/routes/verification.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', verificationRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

function makeCollection(overrides = {}) {
  return {
    getOne: vi.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com', emailVerified: false }),
    getFirstListItem: vi.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com', emailVerified: false }),
    update: vi.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com', emailVerified: true }),
    create: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.collection.mockReturnValue(makeCollection());
  mockPb.send.mockResolvedValue(undefined);
});

// ─── POST /send-verification-email ────────────────────────────────────────────

describe('POST /send-verification-email', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app).post('/send-verification-email').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId/i);
  });

  it('returns 400 for a blank userId', async () => {
    const res = await request(app).post('/send-verification-email').send({ userId: '   ' });
    expect(res.status).toBe(400);
  });

  it('sends a verification email and returns success', async () => {
    const res = await request(app).post('/send-verification-email').send({ userId: 'user-1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPb.send).toHaveBeenCalledOnce();
  });

  it('sends email to the address from the user record', async () => {
    await request(app).post('/send-verification-email').send({ userId: 'user-1' });
    expect(mockPb.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com' }));
  });

  it('includes a /complete-profile/{token} link in the email body', async () => {
    await request(app).post('/send-verification-email').send({ userId: 'user-1' });
    const emailPayload = mockPb.send.mock.calls[0][0];
    expect(emailPayload.html).toMatch(/\/complete-profile\/[a-f0-9]+/);
  });

  it('throws when pb.send fails', async () => {
    mockPb.send.mockRejectedValue(new Error('SMTP error'));
    const res = await request(app).post('/send-verification-email').send({ userId: 'user-1' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/SMTP error/i);
  });
});

// ─── POST /verify-email ───────────────────────────────────────────────────────

describe('POST /verify-email', () => {
  it('returns 400 when token is missing', async () => {
    const res = await request(app).post('/verify-email').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/token/i);
  });

  it('throws for a token that was never issued', async () => {
    const res = await request(app).post('/verify-email').send({ token: 'a'.repeat(64) });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('verifies the email and returns the updated user when the token is valid', async () => {
    // Pre-seed the in-memory store with a known token
    const token = 'a'.repeat(64);
    storeToken(token, 'user-1', 'user@example.com');

    const res = await request(app).post('/verify-email').send({ token });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.emailVerified).toBe(true);
  });

  it('marks the user as emailVerified in the database', async () => {
    const token = 'b'.repeat(64);
    storeToken(token, 'user-1', 'user@example.com');
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);

    await request(app).post('/verify-email').send({ token });
    expect(col.update).toHaveBeenCalledWith('user-1', { emailVerified: true });
  });

  it('throws when the same token is used a second time', async () => {
    const token = 'c'.repeat(64);
    storeToken(token, 'user-1', 'user@example.com');

    // First use — valid
    await request(app).post('/verify-email').send({ token });
    // Second use — should fail
    const res = await request(app).post('/verify-email').send({ token });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });
});

// ─── POST /resend-verification-email ─────────────────────────────────────────

describe('POST /resend-verification-email', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/resend-verification-email').send({});
    expect(res.status).toBe(400);
  });

  it('returns success without sending when the user does not exist (no enumeration)', async () => {
    mockPb.collection.mockReturnValue(makeCollection({
      getFirstListItem: vi.fn().mockRejectedValue(new Error('Not found')),
    }));
    const res = await request(app).post('/resend-verification-email').send({ email: 'ghost@nowhere.com' });
    expect(res.status).toBe(200);
    expect(mockPb.send).not.toHaveBeenCalled();
  });

  it('returns success without sending when email is already verified', async () => {
    mockPb.collection.mockReturnValue(makeCollection({
      getFirstListItem: vi.fn().mockResolvedValue({
        id: 'user-1', email: 'user@example.com', emailVerified: true,
      }),
    }));
    const res = await request(app).post('/resend-verification-email').send({ email: 'user@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/already verified/i);
    expect(mockPb.send).not.toHaveBeenCalled();
  });

  it('sends email and returns success for an unverified user', async () => {
    const res = await request(app).post('/resend-verification-email').send({ email: 'user@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPb.send).toHaveBeenCalledOnce();
  });

  it('normalises the email to lowercase before lookup', async () => {
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);
    await request(app).post('/resend-verification-email').send({ email: 'User@EXAMPLE.COM' });
    expect(col.getFirstListItem).toHaveBeenCalledWith(expect.stringContaining('user@example.com'));
  });
});
