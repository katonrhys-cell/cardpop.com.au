import { describe, it, expect, vi } from 'vitest';

import { syncMarketplaceListing } from '../../../src/services/vaultListingService.js';

// A chainable, awaitable query builder — every method returns the builder and
// awaiting it resolves the given result, mirroring supabase-js semantics.
function builder(result) {
  const b = {
    select: vi.fn(() => b),
    update: vi.fn(() => b),
    insert: vi.fn(() => b),
    eq: vi.fn(() => b),
    neq: vi.fn(() => b),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}

function clientReturning(...results) {
  const builders = results.map(builder);
  let call = 0;
  return { from: vi.fn(() => builders[call++]), builders };
}

const args = (listingType) => ({
  cardId: 'card-1',
  userId: 'user-1',
  listingType,
  pricing: { askingPrice: 10 },
});

describe('syncMarketplaceListing — going private', () => {
  it("returns 'archived' when no non-archived listing remains", async () => {
    const client = clientReturning(
      { error: null },            // archive update
      { data: [], error: null }   // verification: nothing left
    );
    expect(await syncMarketplaceListing(client, args('Private'))).toBe('archived');
  });

  it("returns 'sold_visible' when only a sold listing remains (RLS blocks sellers archiving sold rows)", async () => {
    const client = clientReturning(
      { error: null },
      { data: [{ id: 'l1', status: 'sold' }], error: null }
    );
    expect(await syncMarketplaceListing(client, args('Private'))).toBe('sold_visible');
  });

  it("returns 'error' when a live listing survives the archive", async () => {
    const client = clientReturning(
      { error: null },
      { data: [{ id: 'l1', status: 'active' }], error: null }
    );
    expect(await syncMarketplaceListing(client, args('Private'))).toBe('error');
  });
});

describe('syncMarketplaceListing — going public', () => {
  it("returns 'listed' when the existing listing updates to active", async () => {
    const client = clientReturning(
      { data: { id: 'l1' }, error: null },        // find existing non-archived listing
      { data: { status: 'active' }, error: null } // update it
    );
    expect(await syncMarketplaceListing(client, args('For Sale'))).toBe('listed');
  });

  it("returns 'pending' when the approval trigger holds a new listing", async () => {
    const client = clientReturning(
      { data: null, error: null },                  // no existing listing
      { data: { status: 'pending' }, error: null }  // insert held at pending
    );
    expect(await syncMarketplaceListing(client, args('For Sale'))).toBe('pending');
  });
});
