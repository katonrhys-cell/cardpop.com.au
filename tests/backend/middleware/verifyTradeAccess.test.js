import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockInsert = vi.hoisted(() => vi.fn());
// The profiles lookup: verifyTradeAccess does
// supabase.from('profiles').select('is_verified, has_saved_card').eq('id', uid).maybeSingle().
// Tests set `state.profileRow` to control what that returns.
const state = vi.hoisted(() => ({ profileRow: { is_verified: true, has_saved_card: true } }));
const mockMaybeSingle = vi.hoisted(() => vi.fn(async () => ({ data: state.profileRow, error: null })));
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn((table) => {
    if (table === 'profiles') {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: mockMaybeSingle,
      };
      return chain;
    }
    return { insert: mockInsert };
  }),
}));

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
  // Default: identity-verified + card on file, so email-verified callers pass.
  state.profileRow = { is_verified: true, has_saved_card: true };
  mockMaybeSingle.mockResolvedValue({ data: state.profileRow, error: null });
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

  it('allows email- and identity-verified users to proceed', async () => {
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

  it('blocks email-verified but ID-unverified users with 403 IDENTITY_NOT_VERIFIED', async () => {
    state.profileRow = { is_verified: false, has_saved_card: true };
    mockMaybeSingle.mockResolvedValue({ data: state.profileRow, error: null });
    const next = vi.fn();
    const res = makeRes();
    const req = {
      path: '/trade/offers',
      method: 'POST',
      user: { id: 'user-3', email_confirmed_at: '2026-01-01T00:00:00Z' },
      ip: '5.6.7.8',
      headers: { 'user-agent': 'jest' },
    };
    await verifyTradeAccess(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'IDENTITY_NOT_VERIFIED' });
    expect(next).not.toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-3',
      event_type: 'trade_attempt_id_unverified',
      status: 'blocked',
    }));
  });

  it('blocks ID-verified users without a card on file with 403 CARD_REQUIRED', async () => {
    state.profileRow = { is_verified: true, has_saved_card: false };
    mockMaybeSingle.mockResolvedValue({ data: state.profileRow, error: null });
    const next = vi.fn();
    const res = makeRes();
    const req = {
      path: '/trade/offers',
      method: 'POST',
      user: { id: 'user-4', email_confirmed_at: '2026-01-01T00:00:00Z' },
      ip: '9.9.9.9',
      headers: { 'user-agent': 'jest' },
    };
    await verifyTradeAccess(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'CARD_REQUIRED' });
    expect(next).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-4',
      event_type: 'trade_attempt_no_card',
      status: 'blocked',
    }));
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
