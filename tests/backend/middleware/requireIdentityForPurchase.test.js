import { vi, describe, it, expect, beforeEach } from 'vitest';

// requireIdentityForMarketplacePurchase does
// supabase.from('profiles').select('is_verified').eq('id', uid).maybeSingle().
// `state.profileResult` controls what that resolves to.
const state = vi.hoisted(() => ({ profileResult: { data: { is_verified: true }, error: null } }));
const mockMaybeSingle = vi.hoisted(() => vi.fn(async () => state.profileResult));
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(() => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: mockMaybeSingle };
    return chain;
  }),
}));

vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { requireIdentityForMarketplacePurchase } from '../../../src/middleware/requireIdentityForPurchase.js';

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

async function run(body, user) {
  const req = { body, user };
  const res = makeRes();
  const next = vi.fn();
  await requireIdentityForMarketplacePurchase(req, res, next);
  return { res, next };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.profileResult = { data: { is_verified: true }, error: null };
});

describe('requireIdentityForMarketplacePurchase', () => {
  it('passes a shop-only cart through without any auth or lookup', async () => {
    const { next, res } = await run({ items: [{ type: 'shop', id: 's1' }] }, null);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('passes an empty / typeless cart through', async () => {
    const { next } = await run({ items: [] }, null);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('401s a guest buying a marketplace listing (cart shape)', async () => {
    const { next, res } = await run({ items: [{ type: 'listing', id: 'l1' }] }, null);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('IDENTITY_REQUIRED');
  });

  it('401s a guest buying a marketplace listing (single-item listingId shape)', async () => {
    const { next, res } = await run({ listingId: 'l1' }, null);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('IDENTITY_REQUIRED');
  });

  it('403s an authenticated but ID-unverified buyer', async () => {
    state.profileResult = { data: { is_verified: false }, error: null };
    const { next, res } = await run({ items: [{ type: 'listing', id: 'l1' }] }, { id: 'u1' });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('IDENTITY_NOT_VERIFIED');
  });

  it('403s when the profile row is missing entirely', async () => {
    state.profileResult = { data: null, error: null };
    const { next, res } = await run({ listingId: 'l1' }, { id: 'u1' });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('IDENTITY_NOT_VERIFIED');
  });

  it('passes an authenticated, identity-verified buyer', async () => {
    state.profileResult = { data: { is_verified: true }, error: null };
    const { next, res } = await run({ items: [{ type: 'listing', id: 'l1' }] }, { id: 'u1' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });

  it('gates a mixed cart (shop + listing) on identity', async () => {
    state.profileResult = { data: { is_verified: false }, error: null };
    const { next, res } = await run(
      { items: [{ type: 'shop', id: 's1' }, { type: 'listing', id: 'l1' }] },
      { id: 'u1' },
    );
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails open (passes the buyer) when the profile read errors', async () => {
    state.profileResult = { data: null, error: { message: 'db down' } };
    const { next, res } = await run({ listingId: 'l1' }, { id: 'u1' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });
});
