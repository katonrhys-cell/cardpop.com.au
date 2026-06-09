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
  parseUserAgent: vi.fn().mockReturnValue({ browser: 'Chrome', os: 'Windows' }),
  getDeviceName: vi.fn().mockReturnValue('Chrome on Windows'),
}));

import devicesRouter from '../../../src/routes/auth/devices.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', devicesRouter);
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
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: fn => Promise.resolve(result).catch(fn),
  };
  return b;
}

beforeEach(() => vi.clearAllMocks());

// ─── GET / ────────────────────────────────────────────────────────────────────

describe('GET /', () => {
  it('returns devices derived from active sessions', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: { active_sessions: [SESSION] }, error: null }));
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.devices).toHaveLength(1);
    expect(res.body.devices[0].sessionId).toBe('sess-1');
    expect(res.body.devices[0].browser).toBe('Chrome');
    expect(res.body.devices[0].os).toBe('Windows');
    expect(res.body.devices[0].isCurrent).toBe(false);
  });

  it('returns empty array when no sessions', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: { active_sessions: null }, error: null }));
    const res = await request(app).get('/');
    expect(res.body.devices).toEqual([]);
  });
});

// ─── POST /:sessionId/trust ───────────────────────────────────────────────────

describe('POST /:sessionId/trust', () => {
  it('marks a session as trusted', async () => {
    const updateBuilder = makeBuilder({ data: null, error: null });
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: { active_sessions: [SESSION] }, error: null }))
      .mockReturnValueOnce(updateBuilder);
    const res = await request(app).post('/sess-1/trust');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const updatedSessions = updateBuilder.update.mock.calls[0][0].active_sessions;
    expect(updatedSessions[0].trusted).toBe(true);
  });

  it('returns 404 when session is not found', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: { active_sessions: [] }, error: null }));
    const res = await request(app).post('/nonexistent/trust');
    expect(res.status).toBe(404);
  });
});
