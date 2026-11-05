import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// GET /admin/ai-usage — the Finance page's AI spend card.

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: {} }));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'admin-1' }; next(); },
  isAdminUser: vi.fn(async () => true),
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
  default: (_req, _res, next) => next(),
}));
vi.mock('../../src/utils/exchangeRates.js', () => ({ getUsdToAudRate: vi.fn(async () => 1.5) }));
vi.mock('../../src/utils/platformSettings.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getPlatformSetting: vi.fn(async (key, def) => (key === 'ai_monthly_limit_grade_estimate' ? 5 : def)),
}));

const { default: adminRouter } = await import('../../src/routes/admin.js');
const app = express().use(express.json()).use('/admin', adminRouter);

beforeEach(() => { mockSupabase.rpc.mockReset(); });

describe('GET /admin/ai-usage', () => {
  it('returns rows, USD and AUD totals and the effective allowances for an Australian date range', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        { feature: 'grade_estimate', model: 'claude-sonnet-5-5', calls: 4, members: 2, cost_usd: '0.0820' },
        { feature: 'card_scan', model: 'claude-haiku-5-5', calls: 40, members: 9, cost_usd: '0.0180' },
      ],
      error: null,
    });
    const res = await request(app).get('/admin/ai-usage?from=2026-11-01&to=2026-11-05');
    expect(res.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('ai_usage_summary', {
      p_from: '2026-11-01T00:00:00+10:00',
      p_to: '2026-11-05T14:00:00.000Z', // 6 Nov 00:00 at UTC+10, exclusive
    });
    expect(res.body.totals).toEqual({ calls: 44, cost_usd: 0.1, cost_aud: 0.15 });
    expect(res.body.allowances.grade_estimate.limit).toBe(5);
    expect(res.body.allowances.card_scan.limit).toBe(300);
  });

  it('rejects a range that ends before it starts', async () => {
    const res = await request(app).get('/admin/ai-usage?from=2026-11-05&to=2026-11-01');
    expect(res.status).toBe(400);
  });

  it('answers 502 when the summary cannot be read', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    expect((await request(app).get('/admin/ai-usage')).status).toBe(502);
  });
});
