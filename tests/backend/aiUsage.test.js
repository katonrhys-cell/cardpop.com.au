import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// The AI usage ledger (src/utils/aiUsage.js) and the monthly allowance
// middleware (src/middleware/aiAllowance.js).

const db = vi.hoisted(() => ({ inserts: [], count: 0, countError: null, insertError: null, lastCountFilters: [] }));
vi.mock('../../src/utils/supabaseClient.js', () => ({
  default: {
    from: () => ({
      insert: async (row) => { db.inserts.push(row); return { error: db.insertError }; },
      select: () => {
        const q = {
          eq: (col, val) => { db.lastCountFilters.push([col, val]); return q; },
          gte: (col, val) => { db.lastCountFilters.push([col, val]); return Promise.resolve({ count: db.count, error: db.countError }); },
        };
        return q;
      },
    }),
  },
}));
const settings = vi.hoisted(() => ({ values: {} }));
vi.mock('../../src/utils/platformSettings.js', () => ({
  getPlatformSetting: async (key, def) => (key in settings.values ? settings.values[key] : def),
}));
const admin = vi.hoisted(() => ({ is: false }));
vi.mock('../../src/middleware/auth.js', () => ({ isAdminUser: async () => admin.is }));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { costUsd, normaliseUsage, recordAiUsage, checkAiAllowance, monthStartSydney } = await import('../../src/utils/aiUsage.js');
const { requireAiAllowance } = await import('../../src/middleware/aiAllowance.js');

beforeEach(() => {
  db.inserts = []; db.count = 0; db.countError = null; db.insertError = null; db.lastCountFilters = [];
  settings.values = {};
  admin.is = false;
});

describe('costUsd', () => {
  it('prices each token kind at the model rate', () => {
    // Sonnet 5.5: $2 in, $10 out, $0.20 cache read, $2.50 cache write per MTok.
    const usage = { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 0 };
    expect(costUsd('claude-sonnet-5-5', usage)).toBeCloseTo(2 + 1 + 0.2, 6);
  });
  it('halves token cost for batch requests and adds web searches at full price', () => {
    const usage = { input_tokens: 2_000_000, output_tokens: 0, server_tool_use: { web_search_requests: 3 } };
    expect(costUsd('claude-opus-5-5', usage, { batch: true })).toBeCloseTo(4 + 0.03, 6);
  });
  it('prices an unknown model at the most expensive listed rate rather than free', () => {
    expect(costUsd('claude-mystery', { input_tokens: 1_000_000 })).toBeCloseTo(4, 6);
  });
  it('treats missing fields as zero', () => {
    expect(normaliseUsage({})).toEqual({ input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, web_search_requests: 0 });
  });
});

describe('recordAiUsage', () => {
  it('writes one row with the computed cost', async () => {
    await recordAiUsage({ feature: 'card_scan', model: 'claude-haiku-5-5', usage: { input_tokens: 1000, output_tokens: 200 }, userId: 'u1' });
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]).toMatchObject({ feature: 'card_scan', model: 'claude-haiku-5-5', user_id: 'u1', input_tokens: 1000, output_tokens: 200, batch: false });
    expect(db.inserts[0].cost_usd).toBeCloseTo((1000 * 0.10 + 200 * 0.50) / 1e6, 9);
  });
  it('never throws when the write fails', async () => {
    db.insertError = { message: 'down' };
    await expect(recordAiUsage({ feature: 'x', model: 'claude-haiku-5-5', usage: {} })).resolves.toBeUndefined();
  });
});

describe('monthStartSydney', () => {
  it('is midnight on the 1st in Sydney (AEDT, UTC+11, in November)', () => {
    expect(monthStartSydney(new Date('2026-11-05T09:00:00Z'))).toBe('2026-10-31T13:00:00.000Z');
  });
  it('rolls over at Sydney midnight, not UTC', () => {
    // 1 Dec 00:30 AEDT is still 30 Nov in UTC.
    expect(monthStartSydney(new Date('2026-11-30T13:30:00Z'))).toBe('2026-11-30T13:00:00.000Z');
  });
});

describe('checkAiAllowance', () => {
  it('allows up to the limit and counts only this member, feature and month', async () => {
    settings.values.ai_monthly_limit_grade_estimate = 3;
    db.count = 2;
    expect(await checkAiAllowance('u1', 'grade_estimate')).toEqual({ allowed: true, used: 2, limit: 3 });
    expect(db.lastCountFilters.slice(0, 2)).toEqual([['user_id', 'u1'], ['feature', 'grade_estimate']]);
    db.count = 3;
    expect((await checkAiAllowance('u1', 'grade_estimate')).allowed).toBe(false);
  });
  it('treats a limit of 0 as unlimited without counting', async () => {
    settings.values.ai_monthly_limit_card_scan = 0;
    db.count = 99999;
    expect(await checkAiAllowance('u1', 'card_scan')).toEqual({ allowed: true, used: 0, limit: 0 });
  });
  it('fails open when the ledger cannot be read', async () => {
    db.countError = { message: 'timeout' };
    expect((await checkAiAllowance('u1', 'card_scan')).allowed).toBe(true);
  });
});

describe('requireAiAllowance', () => {
  const app = express();
  app.post('/x', (req, _res, next) => { req.userId = 'u1'; next(); }, requireAiAllowance('grade_estimate'), (_req, res) => res.json({ ok: true }));

  it('refuses with 429 once the allowance is used', async () => {
    settings.values.ai_monthly_limit_grade_estimate = 2;
    db.count = 2;
    const res = await request(app).post('/x');
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: 'ai_allowance_exhausted', used: 2, limit: 2 });
    expect(res.body.error).toMatch(/grade estimates/);
  });
  it('lets admins through regardless', async () => {
    settings.values.ai_monthly_limit_grade_estimate = 1;
    db.count = 50;
    admin.is = true;
    expect((await request(app).post('/x')).status).toBe(200);
  });
  it('passes while under the limit', async () => {
    db.count = 0;
    expect((await request(app).post('/x')).status).toBe(200);
  });
});
