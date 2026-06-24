import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockInsert = vi.hoisted(() => vi.fn());
const mockSupabase = vi.hoisted(() => ({ from: vi.fn(() => ({ insert: mockInsert })) }));

vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { verifyTradeAccess } from '../../../src/middleware/verifyTradeAccess.js';

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
});

describe('verifyTradeAccess', () => {
  it('passes through non-trade routes without any checks', async () => {
    const next = vi.fn();
    const res = makeRes();
    await verifyTradeAccess({ path: '/ebay/search', user: null }, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated trade requests with 401', async () => {
    const next = vi.fn();
    const res = makeRes();
    await verifyTradeAccess({ path: '/trade/offers', method: 'POST', user: null, headers: {} }, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks unverified users with 403 and writes an audit log', async () => {
    const next = vi.fn();
    const res = makeRes();
    const req = {
      path: '/trade/offers',
      method: 'POST',
      user: { id: 'user-1', email_confirmed_at: null },
      ip: '1.2.3.4',
      headers: { 'user-agent': 'jest' },
    };
    await verifyTradeAccess(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    expect(next).not.toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      event_type: 'trade_attempt_unverified',
      status: 'blocked',
      ip_address: '1.2.3.4',
    }));
  });

  it('allows verified users to proceed', async () => {
    const next = vi.fn();
    const res = makeRes();
    const req = {
      path: '/trade/offers',
      method: 'GET',
      user: { id: 'user-2', email_confirmed_at: '2026-01-01T00:00:00Z' },
      headers: {},
    };
    await verifyTradeAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('matches trade routes case-insensitively', async () => {
    const next = vi.fn();
    const res = makeRes();
    await verifyTradeAccess({ path: '/TRADE/offers', method: 'GET', user: null, headers: {} }, res, next);
    expect(res.statusCode).toBe(401);
  });

  it('returns 500 when the check itself throws', async () => {
    const next = vi.fn();
    const res = makeRes();
    // No `path` → req.path.toLowerCase() throws, exercising the catch block.
    await verifyTradeAccess({ user: null, headers: {} }, res, next);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'VERIFICATION_ERROR' });
  });

  it('still blocks even if the audit-log write fails', async () => {
    mockInsert.mockReturnValue(Promise.reject(new Error('db down')));
    const next = vi.fn();
    const res = makeRes();
    const req = {
      path: '/trade/x', method: 'POST',
      user: { id: 'u', email_confirmed_at: null }, headers: {},
    };
    await verifyTradeAccess(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});
