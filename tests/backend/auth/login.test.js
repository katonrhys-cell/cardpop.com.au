import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mock pocketbase before importing the router ───────────────────────────

const mockPb = vi.hoisted(() => ({
  collection: vi.fn(),
  authStore: { save: vi.fn(), record: { id: 'user-123', email: 'test@example.com' } },
  send: vi.fn(),
}));

vi.mock('../../../src/utils/pocketbaseClient.js', () => ({ default: mockPb }));

import loginRouter from '../../../src/routes/auth/login.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', loginRouter);
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
    delete: vi.fn().mockResolvedValue(true),
    authWithPassword: vi.fn(),
    requestOTP: vi.fn(),
    ...overrides,
  };
}

// ─── POST /attempt ────────────────────────────────────────────────────────────

describe('POST /attempt', () => {
  const app = makeApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPb.collection.mockReturnValue(makeCollection());
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/attempt').send({ ipAddress: '1.2.3.4' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 when ipAddress is missing', async () => {
    const res = await request(app).post('/attempt').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 200 allowed:true when no previous attempts exist', async () => {
    mockPb.collection.mockReturnValue(makeCollection({ getFullList: vi.fn().mockResolvedValue([]) }));
    const res = await request(app).post('/attempt').send({ email: 'a@b.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
  });

  it('returns 429 when account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 900_000).toISOString();
    mockPb.collection.mockReturnValue(makeCollection({
      getFullList: vi.fn().mockResolvedValue([
        { failedAttempts: 5, lockedUntil },
      ]),
    }));
    const res = await request(app).post('/attempt').send({ email: 'a@b.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(429);
    expect(res.body.lockedUntil).toBeDefined();
  });

  it('returns 200 allowed:true when lock has already expired', async () => {
    const expiredLock = new Date(Date.now() - 1000).toISOString();
    mockPb.collection.mockReturnValue(makeCollection({
      getFullList: vi.fn().mockResolvedValue([
        { failedAttempts: 5, lockedUntil: expiredLock },
      ]),
    }));
    const res = await request(app).post('/attempt').send({ email: 'a@b.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
  });
});

// ─── POST /record-failure ─────────────────────────────────────────────────────

describe('POST /record-failure', () => {
  const app = makeApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPb.collection.mockReturnValue(makeCollection());
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/record-failure').send({ ipAddress: '1.2.3.4' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when ipAddress is missing', async () => {
    const res = await request(app).post('/record-failure').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 200 and creates a first attempt record', async () => {
    const col = makeCollection({ getFullList: vi.fn().mockResolvedValue([]) });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).post('/record-failure').send({ email: 'a@b.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(col.create).toHaveBeenCalledWith(expect.objectContaining({ failedAttempts: 1 }));
  });

  it('increments failedAttempts on an existing record', async () => {
    const existing = { id: 'att-1', failedAttempts: 2, lockedUntil: new Date().toISOString() };
    const col = makeCollection({ getFullList: vi.fn().mockResolvedValue([existing]) });
    mockPb.collection.mockReturnValue(col);
    await request(app).post('/record-failure').send({ email: 'a@b.com', ipAddress: '1.2.3.4' });
    expect(col.update).toHaveBeenCalledWith('att-1', expect.objectContaining({ failedAttempts: 3 }));
  });
});

// ─── POST /record-success ─────────────────────────────────────────────────────

describe('POST /record-success', () => {
  const app = makeApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPb.collection.mockReturnValue(makeCollection());
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/record-success').send({});
    expect(res.status).toBe(400);
  });

  it('deletes all attempt records on success', async () => {
    const col = makeCollection({
      getFullList: vi.fn().mockResolvedValue([{ id: 'att-1' }, { id: 'att-2' }]),
    });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).post('/record-success').send({ email: 'a@b.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(col.delete).toHaveBeenCalledTimes(2);
  });
});

// ─── POST /authenticate ───────────────────────────────────────────────────────

describe('POST /authenticate', () => {
  const app = makeApp();

  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/authenticate').send({ password: 'pw', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/authenticate').send({ email: 'a@b.com', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when ipAddress is missing', async () => {
    const res = await request(app).post('/authenticate').send({ email: 'a@b.com', password: 'pw' });
    expect(res.status).toBe(400);
  });

  it('returns 429 when account is locked before auth attempt', async () => {
    const lockedUntil = new Date(Date.now() + 900_000).toISOString();
    mockPb.collection.mockReturnValue(makeCollection({
      getFullList: vi.fn().mockResolvedValue([{ failedAttempts: 5, lockedUntil }]),
    }));
    const res = await request(app)
      .post('/authenticate')
      .send({ email: 'a@b.com', password: 'pw', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(429);
  });

  it('records a failed attempt and throws on wrong credentials', async () => {
    const col = makeCollection({
      getFullList: vi.fn().mockResolvedValue([]),
      authWithPassword: vi.fn().mockRejectedValue(new Error('Invalid credentials')),
    });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app)
      .post('/authenticate')
      .send({ email: 'a@b.com', password: 'wrong', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(500);
    expect(col.create).toHaveBeenCalled(); // first-ever failure → creates a new loginAttempts record
  });

  it('returns otpRequired when user has otpEnabled', async () => {
    const user = { id: 'user-1', email: 'a@b.com', otpEnabled: true, activeSessions: [] };
    const col = makeCollection({
      getFullList: vi.fn().mockResolvedValue([]),
      authWithPassword: vi.fn().mockResolvedValue({ record: user, token: 'tok' }),
      requestOTP: vi.fn().mockResolvedValue({ otpId: 'otp-1' }),
      create: vi.fn().mockResolvedValue({}),
    });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app)
      .post('/authenticate')
      .send({ email: 'a@b.com', password: 'pw', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(res.body.otpRequired).toBe(true);
    expect(res.body.otpId).toBe('otp-1');
  });

  it('returns token and sessionId on successful normal login', async () => {
    const user = { id: 'user-1', email: 'a@b.com', otpEnabled: false, activeSessions: [] };
    const col = makeCollection({
      getFullList: vi.fn().mockResolvedValue([]),
      authWithPassword: vi.fn().mockResolvedValue({ record: user, token: 'jwt-token' }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(true),
    });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app)
      .post('/authenticate')
      .send({ email: 'a@b.com', password: 'Correct1!', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('jwt-token');
    expect(res.body.sessionId).toMatch(/^session_/);
    expect(res.body.user.email).toBe('a@b.com');
  });
});
