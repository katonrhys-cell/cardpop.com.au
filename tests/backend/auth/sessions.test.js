import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockPb = vi.hoisted(() => ({
  collection: vi.fn(),
  authStore: { save: vi.fn(), record: { id: 'user-123', email: 'test@example.com' } },
  send: vi.fn(),
}));

vi.mock('../../../src/utils/pocketbaseClient.js', () => ({ default: mockPb }));

import sessionsRouter from '../../../src/routes/auth/sessions.js';

const AUTH = { Authorization: 'Bearer test-token' };

const SESSION_A = { sessionId: 'sess-aaa', deviceName: 'Chrome/Mac', ipAddress: '1.1.1.1', createdAt: new Date().toISOString(), lastActivityAt: new Date().toISOString() };
const SESSION_B = { sessionId: 'sess-bbb', deviceName: 'Safari/iOS', ipAddress: '2.2.2.2', createdAt: new Date().toISOString(), lastActivityAt: new Date().toISOString() };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', sessionsRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

function makeCollection(overrides = {}) {
  return {
    getOne: vi.fn().mockResolvedValue({ id: 'user-123', activeSessions: [SESSION_A, SESSION_B] }),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.authStore.record = { id: 'user-123', email: 'test@example.com' };
  mockPb.collection.mockReturnValue(makeCollection());
});

// ─── POST /create ─────────────────────────────────────────────────────────────

describe('POST /create', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app).post('/create').send({});
    expect(res.status).toBe(400);
  });

  it('creates a session and returns sessionId + deviceName', async () => {
    mockPb.collection.mockReturnValue(makeCollection({
      getOne: vi.fn().mockResolvedValue({ id: 'user-123', activeSessions: [] }),
    }));
    const res = await request(app)
      .post('/create')
      .set('User-Agent', 'TestBrowser/1.0')
      .send({ userId: 'user-123' });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toMatch(/^session_/);
    expect(res.body.createdAt).toBeDefined();
  });

  it('appends the new session without removing existing ones', async () => {
    const col = makeCollection({
      getOne: vi.fn().mockResolvedValue({ id: 'user-123', activeSessions: [SESSION_A] }),
    });
    mockPb.collection.mockReturnValue(col);
    await request(app).post('/create').send({ userId: 'user-123' });
    const updatedSessions = col.update.mock.calls[0][1].activeSessions;
    expect(updatedSessions).toHaveLength(2);
  });
});

// ─── GET / ────────────────────────────────────────────────────────────────────

describe('GET /', () => {
  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(401);
  });

  it('returns the list of active sessions for authenticated user', async () => {
    const res = await request(app).get('/').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(2);
    expect(res.body.sessions[0].sessionId).toBe('sess-aaa');
  });

  it('returns an empty sessions array when user has no sessions', async () => {
    mockPb.collection.mockReturnValue(makeCollection({
      getOne: vi.fn().mockResolvedValue({ id: 'user-123', activeSessions: [] }),
    }));
    const res = await request(app).get('/').set(AUTH);
    expect(res.body.sessions).toEqual([]);
  });

  it('does not expose internal user fields in the sessions list', async () => {
    const res = await request(app).get('/').set(AUTH);
    const session = res.body.sessions[0];
    expect(session).toHaveProperty('sessionId');
    expect(session).toHaveProperty('deviceName');
    expect(session).toHaveProperty('ipAddress');
    expect(session).not.toHaveProperty('password');
  });
});

// ─── POST /logout-other ───────────────────────────────────────────────────────

describe('POST /logout-other', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/logout-other').send({ currentSessionId: 'sess-aaa' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when currentSessionId is missing', async () => {
    const res = await request(app).post('/logout-other').send({}).set(AUTH);
    expect(res.status).toBe(400);
  });

  it('keeps only the current session and removes all others', async () => {
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).post('/logout-other').send({ currentSessionId: 'sess-aaa' }).set(AUTH);
    expect(res.status).toBe(200);
    const updatedSessions = col.update.mock.calls[0][1].activeSessions;
    expect(updatedSessions).toHaveLength(1);
    expect(updatedSessions[0].sessionId).toBe('sess-aaa');
  });
});

// ─── DELETE /:sessionId ───────────────────────────────────────────────────────

describe('DELETE /:sessionId', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/sess-aaa');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the session does not exist', async () => {
    const res = await request(app).delete('/sess-unknown').set(AUTH);
    expect(res.status).toBe(404);
  });

  it('removes the target session and keeps the others', async () => {
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).delete('/sess-aaa').set(AUTH);
    expect(res.status).toBe(200);
    const updatedSessions = col.update.mock.calls[0][1].activeSessions;
    expect(updatedSessions).toHaveLength(1);
    expect(updatedSessions[0].sessionId).toBe('sess-bbb');
  });
});
