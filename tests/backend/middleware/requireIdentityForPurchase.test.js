import { vi, describe, it, expect, beforeEach } from 'vitest';

// requireIdentityForMarketplacePurchase reads
//   supabase.from('listings').select('id, price_aud').in('id', ids)
//   supabase.from('profiles').select('is_verified').eq('id', uid).maybeSingle()
// `state` controls what each resolves to, plus the identity threshold setting.
const state = vi.hoisted(() => ({
  profileResult: { data: { is_verified: true }, error: null },
  listingsResult: { data: [{ id: 'l1', price_aud: 100 }], error: null },
  threshold: 500,
}));
const mockMaybeSingle = vi.hoisted(() => vi.fn(async () => state.profileResult));
const mockIn = vi.hoisted(() => vi.fn(async () => state.listingsResult));
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn((table) => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: mockMaybeSingle, in: mockIn };
    chain.table = table;
    return chain;
  }),
}));

vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../src/services/commissionService.js', () => ({
  getPlatformSetting: vi.fn(async (_key, fallback) => (state.threshold === undefined ? fallback : state.threshold)),
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

const profilesQueried = () => mockSupabase.from.mock.calls.some(([t]) => t === 'profiles');

beforeEach(() => {
  vi.clearAllMocks();
  state.profileResult = { data: { is_verified: true }, error: null };
  state.listingsResult = { data: [{ id: 'l1', price_aud: 100 }], error: null };
  state.threshold = 500;
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

  it('lets an unverified signed-in buyer through under the threshold without reading the profile', async () => {
    state.profileResult = { data: { is_verified: false }, error: null };
    state.listingsResult = { data: [{ id: 'l1', price_aud: 499.99 }], error: null };
    const { next, res } = await run({ items: [{ type: 'listing', id: 'l1' }] }, { id: 'u1' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
    expect(profilesQueried()).toBe(false);
  });

  it('403s an unverified buyer at the threshold', async () => {
    state.profileResult = { data: { is_verified: false }, error: null };
    state.listingsResult = { data: [{ id: 'l1', price_aud: 500 }], error: null };
    const { next, res } = await run({ items: [{ type: 'listing', id: 'l1' }] }, { id: 'u1' });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('IDENTITY_NOT_VERIFIED');
    expect(res.body.thresholdAud).toBe(500);
  });

  it('sums every marketplace line against the threshold', async () => {
    state.profileResult = { data: { is_verified: false }, error: null };
    state.listingsResult = { data: [{ id: 'l1', price_aud: 300 }, { id: 'l2', price_aud: 250 }], error: null };
    const { res } = await run({ items: [{ type: 'listing', id: 'l1' }, { type: 'listing', id: 'l2' }, { type: 'shop', id: 's1' }] }, { id: 'u1' });
    expect(res.statusCode).toBe(403);
    expect(mockIn).toHaveBeenCalledWith('id', ['l1', 'l2']);
  });

  it('a threshold of 0 requires ID on every marketplace order', async () => {
    state.threshold = 0;
    state.profileResult = { data: { is_verified: false }, error: null };
    state.listingsResult = { data: [{ id: 'l1', price_aud: 5 }], error: null };
    const { res } = await run({ listingId: 'l1' }, { id: 'u1' });
    expect(res.statusCode).toBe(403);
  });

  it('403s when the profile row is missing entirely (over threshold)', async () => {
    state.profileResult = { data: null, error: null };
    state.listingsResult = { data: [{ id: 'l1', price_aud: 900 }], error: null };
    const { res } = await run({ listingId: 'l1' }, { id: 'u1' });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('IDENTITY_NOT_VERIFIED');
  });

  it('passes an authenticated, identity-verified buyer over the threshold', async () => {
    state.listingsResult = { data: [{ id: 'l1', price_aud: 2500 }], error: null };
    const { next, res } = await run({ items: [{ type: 'listing', id: 'l1' }] }, { id: 'u1' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });

  it('gates a mixed cart (shop + listing) on identity when the listing value qualifies', async () => {
    state.profileResult = { data: { is_verified: false }, error: null };
    state.listingsResult = { data: [{ id: 'l1', price_aud: 800 }], error: null };
    const { next, res } = await run(
      { items: [{ type: 'shop', id: 's1' }, { type: 'listing', id: 'l1' }] },
      { id: 'u1' },
    );
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('falls through to the ID check when the listing price read fails', async () => {
    state.profileResult = { data: { is_verified: false }, error: null };
    state.listingsResult = { data: null, error: { message: 'db down' } };
    const { res } = await run({ listingId: 'l1' }, { id: 'u1' });
    expect(res.statusCode).toBe(403);
  });

  it('fails open (passes the buyer) when the profile read errors', async () => {
    state.profileResult = { data: null, error: { message: 'db down' } };
    state.listingsResult = { data: [{ id: 'l1', price_aud: 900 }], error: null };
    const { next, res } = await run({ listingId: 'l1' }, { id: 'u1' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });
});
