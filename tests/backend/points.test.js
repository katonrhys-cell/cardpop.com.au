import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next(); },
  optionalAuthMiddleware: (req, _res, next) => next(),
  isAdminUser: vi.fn(),
}));

import pointsRouter from '../../src/routes/points.js';

const app = express();
app.use(express.json());
app.use('/', pointsRouter);

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}

beforeEach(() => vi.clearAllMocks());

describe('GET /me', () => {
  it('returns totals, claim state and recent rows', async () => {
    const monthStartIso = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
    const rows = [
      { points: 25, created_at: new Date().toISOString() },              // this month
      { points: 10, created_at: '2020-01-05T00:00:00.000Z' },            // long ago
    ];
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: rows, error: null }))     // all rows
      .mockReturnValueOnce(makeBuilder({ count: 1, error: null }))       // today's claim
      .mockReturnValueOnce(makeBuilder({ data: rows.slice(0, 1), error: null })); // recent

    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(35);
    expect(res.body.monthTotal).toBe(25);
    expect(res.body.claimedToday).toBe(true);
    expect(res.body.recent).toHaveLength(1);
    expect(monthStartIso.endsWith('T00:00:00.000Z')).toBe(true);
  });
});

describe('POST /claim', () => {
  it('awards a claim in the configured range', async () => {
    const builder = makeBuilder({ error: null });
    mockSupabase.from.mockReturnValueOnce(builder);
    const res = await request(app).post('/claim');
    expect(res.status).toBe(201);
    expect(res.body.points).toBeGreaterThanOrEqual(5);
    expect(res.body.points).toBeLessThanOrEqual(25);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1', reason: 'daily_claim',
    }));
  });

  it('returns 409 when today is already claimed (unique index conflict)', async () => {
    mockSupabase.from.mockReturnValueOnce(makeBuilder({ error: { code: '23505' } }));
    const res = await request(app).post('/claim');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already claimed/i);
  });
});

describe('GET /leaderboard', () => {
  it('returns the monthly leaders from the aggregate RPC', async () => {
    const leaders = [{ user_id: 'u1', total_points: 90, display_name: 'Ada', username: 'ada', avatar_url: null }];
    mockSupabase.rpc.mockResolvedValueOnce({ data: leaders, error: null });
    const res = await request(app).get('/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.leaders).toEqual(leaders);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('points_leaderboard', expect.objectContaining({ p_limit: 20 }));
  });

  it('returns 500 when the RPC errors', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    const res = await request(app).get('/leaderboard');
    expect(res.status).toBe(500);
  });
});
