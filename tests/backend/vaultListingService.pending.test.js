import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { syncMarketplaceListing } = await import('../../src/services/vaultListingService.js');

// Fake caller-scoped client: the lookup returns `existing`, the write echoes
// the status it was given (no DB trigger in play), and every payload is kept.
const makeClient = (existing) => {
  const writes = [];
  const chain = (result, payload) => {
    const b = {};
    ['select', 'eq', 'neq'].forEach((m) => { b[m] = vi.fn(() => b); });
    b.maybeSingle = vi.fn(() => Promise.resolve(result));
    b.single = vi.fn(() => Promise.resolve({ data: { status: payload?.status }, error: null }));
    return b;
  };
  return {
    writes,
    from: () => ({
      select: () => chain({ data: existing, error: null }),
      update: (payload) => { writes.push({ op: 'update', payload }); return chain(null, payload); },
      insert: (payload) => { writes.push({ op: 'insert', payload }); return chain(null, payload); },
    }),
  };
};

const args = { cardId: 'c1', userId: 'u1', listingType: 'For Sale', pricing: { askingPrice: 10 } };

describe('syncMarketplaceListing — approval hold', () => {
  it('keeps a pending listing pending when the card is edited', async () => {
    const client = makeClient({ id: 'l1', status: 'pending' });
    const result = await syncMarketplaceListing(client, args);
    expect(client.writes).toHaveLength(1);
    expect(client.writes[0].op).toBe('update');
    expect(client.writes[0].payload.status).toBe('pending');
    expect(result).toBe('pending');
  });

  it('keeps an active listing active', async () => {
    const client = makeClient({ id: 'l1', status: 'active' });
    const result = await syncMarketplaceListing(client, args);
    expect(client.writes[0].payload.status).toBe('active');
    expect(result).toBe('listed');
  });

  it('inserts a new listing as active (trigger decides on approval)', async () => {
    const client = makeClient(null);
    await syncMarketplaceListing(client, args);
    expect(client.writes[0].op).toBe('insert');
    expect(client.writes[0].payload.status).toBe('active');
  });
});
