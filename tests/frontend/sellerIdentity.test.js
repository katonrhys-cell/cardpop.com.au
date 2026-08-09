import { describe, it, expect } from 'vitest';
import { sellerFromProfile, OFFICIAL_STORE_NAME } from '@/lib/sellerIdentity.js';

describe('sellerFromProfile', () => {
  it('brands the platform account as the Official CardPop Store', () => {
    const seller = sellerFromProfile({
      id: 'store-id',
      is_admin: true,
      is_sole_trader: true,
      store_slug: 'cardpop',
      business_name: 'CardPop',
      display_name: 'admin',
      username: 'admin',
      is_verified: true,
    });
    expect(seller.type).toBe('official');
    // Never the raw display_name ('admin') — that is exactly the bug this fixes.
    expect(seller.business_name).toBe(OFFICIAL_STORE_NAME);
    expect(seller.storePath).toBe('/dealer/cardpop');
    expect(seller.is_verified).toBe(true);
  });

  it('official branding applies even before the dealer store fields are set', () => {
    const seller = sellerFromProfile({ id: 'x', is_admin: true, display_name: 'admin' });
    expect(seller.type).toBe('official');
    expect(seller.business_name).toBe(OFFICIAL_STORE_NAME);
    expect(seller.is_verified).toBe(true); // the platform's own store is trusted
    expect(seller.storePath).toBeNull();
  });

  it('shows a dealer under their business name, linking to their store', () => {
    const seller = sellerFromProfile({
      id: 'd1',
      is_sole_trader: true,
      store_slug: 'melbourne-cards',
      business_name: 'Melbourne Cards',
      display_name: 'Sam',
      is_verified: true,
    });
    expect(seller.type).toBe('user');
    expect(seller.isDealer).toBe(true);
    expect(seller.business_name).toBe('Melbourne Cards');
    expect(seller.storePath).toBe('/dealer/melbourne-cards');
  });

  it('a sole trader without a claimed slug is not linked to a store page', () => {
    const seller = sellerFromProfile({
      id: 'd2', is_sole_trader: true, business_name: 'No Slug Yet', display_name: 'Alex',
    });
    expect(seller.isDealer).toBe(false);
    expect(seller.storePath).toBeNull();
    expect(seller.business_name).toBe('Alex');
  });

  it('regular members fall back through display name, username, full name', () => {
    expect(sellerFromProfile({ id: 'u1', display_name: 'RK' }).business_name).toBe('RK');
    expect(sellerFromProfile({ id: 'u2', username: 'katonrhys' }).business_name).toBe('katonrhys');
    expect(sellerFromProfile({ id: 'u3', full_name: 'R K' }).business_name).toBe('R K');
    expect(sellerFromProfile({ id: 'u4' }).business_name).toBe('Community Member');
  });

  it('handles a missing profile row', () => {
    const seller = sellerFromProfile(null, 'fallback-id');
    expect(seller).toMatchObject({
      id: 'fallback-id',
      business_name: 'Community Member',
      is_verified: false,
      type: 'user',
      storePath: null,
    });
  });

  it('never marks an unverified regular member as verified', () => {
    expect(sellerFromProfile({ id: 'u5', display_name: 'X', is_verified: false }).is_verified).toBe(false);
  });
});
