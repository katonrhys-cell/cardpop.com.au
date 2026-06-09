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
}));

import securityRouter from '../../../src/routes/auth/security.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', securityRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: fn => Promise.resolve(result).catch(fn),
  };
  return b;
}

const ALERT = {
  id: 'alert-1', alert_type: 'new_ip', severity: 'medium',
  description: 'Login from a new IP address', ip_address: '5.5.5.5', read: false,
  created_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => vi.clearAllMocks());

// ─── POST /suspicious-activity/check ─────────────────────────────────────────

describe('POST /suspicious-activity/check', () => {
  it('returns not suspicious when no prior logins', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null }));
    const res = await request(app).post('/suspicious-activity/check').send({
      userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'Chrome/100',
    });
    expect(res.status).toBe(200);
    expect(res.body.suspicious).toBe(false);
    expect(res.body.alerts).toEqual([]);
  });

  it('flags new IP and creates security alert', async () => {
    const logsBuilder = makeBuilder({ data: [{ ip_address: '9.9.9.9', user_agent: 'Chrome/100' }], error: null });
    const insertBuilder = makeBuilder({ data: null, error: null });
    mockSupabase.from
      .mockReturnValueOnce(logsBuilder)
      .mockReturnValueOnce(insertBuilder);
    const res = await request(app).post('/suspicious-activity/check').send({
      userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'Chrome/100',
    });
    expect(res.status).toBe(200);
    expect(res.body.suspicious).toBe(true);
    expect(insertBuilder.insert).toHaveBeenCalled();
  });
});

// ─── GET /alerts ──────────────────────────────────────────────────────────────

describe('GET /alerts', () => {
  it('returns alerts with mapped fields', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [ALERT], error: null }));
    const res = await request(app).get('/alerts');
    expect(res.status).toBe(200);
    expect(res.body.alerts).toHaveLength(1);
    expect(res.body.alerts[0].type).toBe('new_ip');
    expect(res.body.alerts[0].id).toBe('alert-1');
  });

  it('returns empty array when no alerts', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null }));
    const res = await request(app).get('/alerts');
    expect(res.body.alerts).toEqual([]);
  });
});

// ─── POST /alerts/mark-read ───────────────────────────────────────────────────

describe('POST /alerts/mark-read', () => {
  it('returns 400 when alertId is missing', async () => {
    const res = await request(app).post('/alerts/mark-read').send({});
    expect(res.status).toBe(400);
  });

  it('marks alert as read', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/alerts/mark-read').send({ alertId: 'alert-1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
