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
vi.mock('../../../src/utils/deviceParser.js', () => ({
  getDeviceName: vi.fn().mockReturnValue('Chrome on Windows'),
  parseUserAgent: vi.fn().mockReturnValue({ browser: 'Chrome', os: 'Windows' }),
}));

import sessionsRouter from '../../../src/routes/auth/sessions.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', sessionsRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// ─── helpers ──────────────────────────────────────────────────────────────────

const SESSION = {
  sessionId: 'sess-1', deviceName: 'Chrome on Windows',
  ipAddress: '1.2.3.4', createdAt: '2026-01-01T00:00:00Z', lastActivityAt: '2026-01-01T00:00:00Z',
};

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

beforeEach(() => vi.clearAllMocks());

// ─── POST /create ─────────────────────────────────────────────────────────────

describe('POST /create', () => {
  it('creates a session and returns sessionId', async () => {
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: { active_sessions: [] }, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/create').send({ userId: 'user-1' });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.deviceName).toBe('Chrome on Windows');
  });

  it('appends to existing sessions', async () => {
    const updateBuilder = makeBuilder({ data: null, error: null });
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: { active_sessions: [SESSION] }, error: null }))
      .mockReturnValueOnce(updateBuilder);
    await request(app).post('/create').send({ userId: 'user-1' });
    expect(updateBuilder.update.mock.calls[0][0].active_sessions).toHaveLength(2);
  });
});

// ─── GET / ────────────────────────────────────────────────────────────────────

describe('GET /', () => {
  it('returns sessions for the authenticated user', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: { active_sessions: [SESSION] }, error: null }));
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0].sessionId).toBe('sess-1');
  });

  it('returns empty array when no sessions', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: { active_sessions: null }, error: null }));
    const res = await request(app).get('/');
    expect(res.body.sessions).toEqual([]);
  });
});

// ─── POST /logout-other ───────────────────────────────────────────────────────

describe('POST /logout-other', () => {
  it('returns 400 when currentSessionId is missing', async () => {
    const res = await request(app).post('/logout-other').send({});
    expect(res.status).toBe(400);
  });

  it('keeps only the current session', async () => {
    const sessions = [SESSION, { ...SESSION, sessionId: 'sess-2' }];
    const updateBuilder = makeBuilder({ data: null, error: null });
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: { active_sessions: sessions }, error: null }))
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(makeBuilder({ data: null, error: null })); // audit
    const res = await request(app).post('/logout-other').send({ currentSessionId: 'sess-1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(updateBuilder.update.mock.calls[0][0].active_sessions).toHaveLength(1);
    expect(updateBuilder.update.mock.calls[0][0].active_sessions[0].sessionId).toBe('sess-1');
  });
});

// ─── DELETE /:sessionId ───────────────────────────────────────────────────────

describe('DELETE /:sessionId', () => {
  it('revokes a specific session', async () => {
    const sessions = [SESSION, { ...SESSION, sessionId: 'sess-2', deviceName: 'Firefox on Mac' }];
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: { active_sessions: sessions }, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))  // update
      .mockReturnValueOnce(makeBuilder({ data: null, error: null })); // audit
    const res = await request(app).delete('/sess-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when session is not found', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: { active_sessions: [] }, error: null }));
    const res = await request(app).delete('/nonexistent');
    expect(res.status).toBe(404);
  });
});
