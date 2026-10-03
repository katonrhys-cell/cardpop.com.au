import { vi, describe, it, expect, beforeEach } from 'vitest';

// requireIdentityForMarketplacePurchase does
// supabase.from('profiles').select('is_verified').eq('id', uid).maybeSingle().
// `state.profileResult` controls what that resolves to.
// The official-store exemption does
// supabase.from('listings').select('id, seller:profiles!seller_id(is_admin)').in('id', ids);
// `state.listingsResult` controls that (default: community sellers only).
const state = vi.hoisted(() => ({
  profileResult: { data: { is_verified: true }, error: null },
  listingsResult: { data: [], error: null },
}));
const mockMaybeSingle = vi.hoisted(() => vi.fn(async () => state.profileResult));
const mockListingsIn = vi.hoisted(() => vi.fn(async () => state.listingsResult));
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(() => {
    const chain = { select: () => chain, eq: () => chain, in: mockListingsIn, maybeSingle: mockMaybeSingle };
    return chain;
  }),
}));

const official = (id) => ({ id, seller: { is_admin: true } });
const community = (id) => ({ id, seller: { is_admin: false } });

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
  state.listingsResult = { data: [], error: null };
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

  describe('Official CardPop Store listings', () => {
    it('lets a guest buy an official-store listing (cart shape) and marks the order', async () => {
      state.listingsResult = { data: [official('l1')], error: null };
      const req = { body: { items: [{ type: 'listing', id: 'l1' }] }, user: null };
      const res = makeRes();
      const next = vi.fn();
      await requireIdentityForMarketplacePurchase(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
      expect(req.officialStoreOrder).toBe(true);
      expect(mockListingsIn).toHaveBeenCalledWith('id', ['l1']);
      expect(mockMaybeSingle).not.toHaveBeenCalled();
    });

    it('lets a guest buy an official-store listing (single-item listingId shape)', async () => {
      state.listingsResult = { data: [official('l1')], error: null };
      const { next, res } = await run({ listingId: 'l1' }, null);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
    });

    it('lets an ID-unverified account buy an official-store listing', async () => {
      state.listingsResult = { data: [official('l1')], error: null };
      state.profileResult = { data: { is_verified: false }, error: null };
      const { next, res } = await run({ items: [{ type: 'listing', id: 'l1' }] }, { id: 'u1' });
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
    });

    it('lets a guest buy official-store listings alongside shop items', async () => {
      state.listingsResult = { data: [official('l1'), official('l2')], error: null };
      const { next } = await run(
        { items: [{ type: 'shop', id: 's1' }, { type: 'listing', id: 'l1' }, { type: 'listing', id: 'l2' }] },
        null,
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('still 401s a guest when one listing is from a community seller', async () => {
      state.listingsResult = { data: [official('l1'), community('l2')], error: null };
      const req = { body: { items: [{ type: 'listing', id: 'l1' }, { type: 'listing', id: 'l2' }] }, user: null };
      const res = makeRes();
      const next = vi.fn();
      await requireIdentityForMarketplacePurchase(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(req.officialStoreOrder).toBeUndefined();
    });

    it('still 403s an unverified account buying a community listing', async () => {
      state.listingsResult = { data: [community('l1')], error: null };
      state.profileResult = { data: { is_verified: false }, error: null };
      const { res } = await run({ items: [{ type: 'listing', id: 'l1' }] }, { id: 'u1' });
      expect(res.statusCode).toBe(403);
    });

    it('applies the normal gate when a listing id is not found', async () => {
      state.listingsResult = { data: [official('l1')], error: null };
      const { next, res } = await run(
        { items: [{ type: 'listing', id: 'l1' }, { type: 'listing', id: 'missing' }] },
        null,
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });

    it('applies the normal gate when the seller lookup errors', async () => {
      state.listingsResult = { data: null, error: { message: 'db down' } };
      const { next, res } = await run({ items: [{ type: 'listing', id: 'l1' }] }, null);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });

    it('applies the normal gate when the seller lookup throws', async () => {
      mockListingsIn.mockRejectedValueOnce(new Error('boom'));
      const { next, res } = await run({ items: [{ type: 'listing', id: 'l1' }] }, null);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });

    it('treats a duplicated official listing id as one listing', async () => {
      state.listingsResult = { data: [official('l1')], error: null };
      const { next } = await run(
        { items: [{ type: 'listing', id: 'l1' }, { type: 'listing', id: 'l1' }] },
        null,
      );
      expect(next).toHaveBeenCalledTimes(1);
      expect(mockListingsIn).toHaveBeenCalledWith('id', ['l1']);
    });
  });
});
