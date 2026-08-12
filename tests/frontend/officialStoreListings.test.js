import { describe, it, expect, vi } from 'vitest';
import {
  fetchOfficialStoreListings,
  mergeShopAndListings,
  gridPrice,
  OFFICIAL_LISTING_SOURCE,
} from '@/lib/officialStoreListings.js';

const shop = (id, price, created) => ({
  id, source: 'shop', price_aud: price, created_at: created,
});
const listing = (id, price, created, extra = {}) => ({
  id, source: OFFICIAL_LISTING_SOURCE, price_aud: price, created_at: created, ...extra,
});

describe('gridPrice', () => {
  it('uses price_aud when present', () => {
    expect(gridPrice({ price_aud: 12.5 })).toBe(12.5);
  });

  it('falls back to the offer-range minimum for EOI listings', () => {
    expect(gridPrice({ price_aud: null, price_min_aud: 15 })).toBe(15);
  });

  it('degrades to 0 when neither is a number', () => {
    expect(gridPrice({})).toBe(0);
    expect(gridPrice({ price_aud: 'abc' })).toBe(0);
  });
});

describe('mergeShopAndListings', () => {
  const shopRows = [shop('s1', 30, '2026-08-01'), shop('s2', 10, '2026-08-03')];
  const listingRows = [listing('l1', 20, '2026-08-02'), listing('l2', null, '2026-08-04', { price_min_aud: 5 })];

  it('sorts newest first by default', () => {
    const merged = mergeShopAndListings(shopRows, listingRows, 'created_at_desc');
    expect(merged.map((r) => r.id)).toEqual(['l2', 's2', 'l1', 's1']);
  });

  it('sorts by price ascending across both sources', () => {
    const merged = mergeShopAndListings(shopRows, listingRows, 'price_asc');
    expect(merged.map((r) => r.id)).toEqual(['l2', 's2', 'l1', 's1']);
  });

  it('sorts by price descending across both sources', () => {
    const merged = mergeShopAndListings(shopRows, listingRows, 'price_desc');
    expect(merged.map((r) => r.id)).toEqual(['s1', 'l1', 's2', 'l2']);
  });

  it('tolerates null inputs', () => {
    expect(mergeShopAndListings(null, null, 'price_asc')).toEqual([]);
  });
});

describe('fetchOfficialStoreListings', () => {
  const makeSupabase = (result) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      then: (resolve) => resolve(result),
    };
    return { from: vi.fn(() => query), _query: query };
  };

  it('tags rows with the official-listing source', async () => {
    const supabase = makeSupabase({ data: [{ id: 'l1' }], error: null });
    const rows = await fetchOfficialStoreListings(supabase);
    expect(supabase.from).toHaveBeenCalledWith('listings');
    expect(rows).toEqual([{ id: 'l1', source: OFFICIAL_LISTING_SOURCE }]);
  });

  it('constrains to active listings from the platform (is_admin) seller', async () => {
    const supabase = makeSupabase({ data: [], error: null });
    await fetchOfficialStoreListings(supabase);
    expect(supabase._query.eq).toHaveBeenCalledWith('status', 'active');
    expect(supabase._query.eq).toHaveBeenCalledWith('seller.is_admin', true);
    expect(supabase._query.neq).toHaveBeenCalledWith('listing_type', 'vault');
  });

  it('applies search and price bounds when provided', async () => {
    const supabase = makeSupabase({ data: [], error: null });
    await fetchOfficialStoreListings(supabase, { searchTerm: 'jrue', minPrice: '5', maxPrice: '30' });
    expect(supabase._query.ilike).toHaveBeenCalledWith('vault_item.card_name', '%jrue%');
    expect(supabase._query.gte).toHaveBeenCalledWith('price_aud', 5);
    expect(supabase._query.lte).toHaveBeenCalledWith('price_aud', 30);
  });

  it('resolves to an empty list on query failure so the shop grid survives', async () => {
    const supabase = makeSupabase({ data: null, error: new Error('boom') });
    await expect(fetchOfficialStoreListings(supabase)).resolves.toEqual([]);
  });
});
