import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockPb = vi.hoisted(() => ({
  collection: vi.fn(),
  authStore: { save: vi.fn(), record: { id: 'user-123', email: 'test@example.com' } },
  send: vi.fn(),
}));

const mockParseUserAgent = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/pocketbaseClient.js', () => ({ default: mockPb }));
vi.mock('../../../src/utils/deviceParser.js', () => ({ parseUserAgent: mockParseUserAgent }));
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
vi.mock('../../../src/utils/logger.js', () => ({ default: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import devicesRouter from '../../../src/routes/auth/devices.js';

// Token equals sessionId of SESSION_A so isCurrent is true for it
const AUTH = { Authorization: 'Bearer sess-aaa' };

const SESSION_A = {
  sessionId: 'sess-aaa',
  deviceName: 'Chrome on Windows',
  ipAddress: '1.1.1.1',
  createdAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
};
const SESSION_B = {
  sessionId: 'sess-bbb',
  deviceName: 'Safari on macOS',
  ipAddress: '2.2.2.2',
  createdAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', devicesRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

function makeCollection(overrides = {}) {
  return {
    getOne: vi.fn().mockResolvedValue({ id: 'user-123', activeSessions: [SESSION_A, SESSION_B] }),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.authStore.record = { id: 'user-123', email: 'test@example.com' };
  mockPb.collection.mockReturnValue(makeCollection());
  mockParseUserAgent.mockReturnValue({ browser: 'Chrome', os: 'Windows', device: 'desktop' });
});

// ─── GET / ────────────────────────────────────────────────────────────────────

describe('GET /', () => {
  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(401);
  });

  it('returns the full devices list for an authenticated user', async () => {
    const res = await request(app).get('/').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.devices).toHaveLength(2);
  });

  it('includes browser and os from the parsed user-agent', async () => {
    const res = await request(app).get('/').set(AUTH);
    const device = res.body.devices[0];
    expect(device.browser).toBe('Chrome');
    expect(device.os).toBe('Windows');
  });

  it('includes sessionId, deviceName, ipAddress, createdAt, lastActivityAt on each device', async () => {
    const res = await request(app).get('/').set(AUTH);
    const device = res.body.devices[0];
    expect(device).toHaveProperty('sessionId');
    expect(device).toHaveProperty('deviceName');
    expect(device).toHaveProperty('ipAddress');
    expect(device).toHaveProperty('createdAt');
    expect(device).toHaveProperty('lastActivityAt');
  });

  it('marks the session whose sessionId matches the bearer token as isCurrent true', async () => {
    // AUTH bearer token is 'sess-aaa', which matches SESSION_A.sessionId
    const res = await request(app).get('/').set(AUTH);
    const current = res.body.devices.find(d => d.sessionId === 'sess-aaa');
    expect(current.isCurrent).toBe(true);
  });

  it('marks all other sessions as isCurrent false', async () => {
    const res = await request(app).get('/').set(AUTH);
    const other = res.body.devices.find(d => d.sessionId === 'sess-bbb');
    expect(other.isCurrent).toBe(false);
  });

  it('returns an empty array when the user has no active sessions', async () => {
    mockPb.collection.mockReturnValue(makeCollection({
      getOne: vi.fn().mockResolvedValue({ id: 'user-123', activeSessions: [] }),
    }));
    const res = await request(app).get('/').set(AUTH);
    expect(res.body.devices).toEqual([]);
  });

  it('calls parseUserAgent once per session', async () => {
    await request(app).get('/').set(AUTH);
    expect(mockParseUserAgent).toHaveBeenCalledTimes(2);
  });
});

// ─── POST /:sessionId/trust ───────────────────────────────────────────────────

describe('POST /:sessionId/trust', () => {
  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).post('/sess-aaa/trust');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the session does not exist', async () => {
    const res = await request(app).post('/sess-unknown/trust').set(AUTH);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/session not found/i);
  });

  it('sets trusted:true on the target session and returns success', async () => {
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).post('/sess-aaa/trust').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const updatedSessions = col.update.mock.calls[0][1].activeSessions;
    const trusted = updatedSessions.find(s => s.sessionId === 'sess-aaa');
    expect(trusted.trusted).toBe(true);
  });

  it('does not modify other sessions when trusting one', async () => {
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);
    await request(app).post('/sess-aaa/trust').set(AUTH);
    const updatedSessions = col.update.mock.calls[0][1].activeSessions;
    const other = updatedSessions.find(s => s.sessionId === 'sess-bbb');
    expect(other.trusted).toBeUndefined();
  });
});

// ─── POST /:sessionId/untrust ─────────────────────────────────────────────────

describe('POST /:sessionId/untrust', () => {
  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).post('/sess-aaa/untrust');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the session does not exist', async () => {
    const res = await request(app).post('/sess-unknown/untrust').set(AUTH);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/session not found/i);
  });

  it('sets trusted:false on a previously-trusted session and returns success', async () => {
    const col = makeCollection({
      getOne: vi.fn().mockResolvedValue({
        id: 'user-123',
        activeSessions: [{ ...SESSION_A, trusted: true }, SESSION_B],
      }),
    });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).post('/sess-aaa/untrust').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const updatedSessions = col.update.mock.calls[0][1].activeSessions;
    const untrusted = updatedSessions.find(s => s.sessionId === 'sess-aaa');
    expect(untrusted.trusted).toBe(false);
  });

  it('does not modify other sessions when untrusting one', async () => {
    const col = makeCollection({
      getOne: vi.fn().mockResolvedValue({
        id: 'user-123',
        activeSessions: [{ ...SESSION_A, trusted: true }, { ...SESSION_B, trusted: true }],
      }),
    });
    mockPb.collection.mockReturnValue(col);
    await request(app).post('/sess-aaa/untrust').set(AUTH);
    const updatedSessions = col.update.mock.calls[0][1].activeSessions;
    const other = updatedSessions.find(s => s.sessionId === 'sess-bbb');
    expect(other.trusted).toBe(true);
  });
});
