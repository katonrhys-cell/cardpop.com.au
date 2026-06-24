import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the last query builder so each test can assert/resolve it.
let lastBuilder;
const makeBuilder = (result = { data: [], error: null }) => {
  const builder = {
    _result: result,
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    upsert: vi.fn(() => Promise.resolve({ error: result.error || null })),
    delete: vi.fn(() => builder),
    then: (...a) => Promise.resolve(result).then(...a),
    catch: (...a) => Promise.resolve(result).catch(...a),
    finally: (...a) => Promise.resolve(result).finally(...a),
  };
  lastBuilder = builder;
  return builder;
};

let nextResult = { data: [], error: null };
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: { from: vi.fn(() => makeBuilder(nextResult)) },
}));

import {
  RSVP_ROLES,
  fetchRsvpCounts,
  fetchMyRsvps,
  setRsvp,
  removeRsvp,
} from '@/lib/eventRsvp.js';

beforeEach(() => {
  nextResult = { data: [], error: null };
  lastBuilder = undefined;
});

describe('eventRsvp helpers', () => {
  it('exposes buyer and vendor roles with plural labels', () => {
    expect(RSVP_ROLES.buyer.plural).toBe('Attendees');
    expect(RSVP_ROLES.vendor.plural).toBe('Vendors');
  });

  it('fetchRsvpCounts returns an empty map for no ids without querying', async () => {
    const map = await fetchRsvpCounts([]);
    expect(map).toEqual({});
    expect(lastBuilder).toBeUndefined();
  });

  it('fetchRsvpCounts maps rows into a per-event count object', async () => {
    nextResult = {
      data: [{ event_id: 'e1', buyer_count: 3, vendor_count: 1 }],
      error: null,
    };
    const map = await fetchRsvpCounts(['e1', 'e1']); // de-duplicates ids
    expect(map).toEqual({ e1: { buyer: 3, vendor: 1 } });
  });

  it('fetchMyRsvps returns empty when no user id', async () => {
    const map = await fetchMyRsvps(null, ['e1']);
    expect(map).toEqual({});
  });

  it('fetchMyRsvps maps the current user roles per event', async () => {
    nextResult = { data: [{ event_id: 'e1', role: 'vendor' }], error: null };
    const map = await fetchMyRsvps('u1', ['e1']);
    expect(map).toEqual({ e1: 'vendor' });
  });

  it('setRsvp rejects an invalid role', async () => {
    await expect(setRsvp('e1', 'u1', 'sponsor')).rejects.toThrow(/Invalid RSVP role/);
  });

  it('setRsvp upserts a valid role', async () => {
    await expect(setRsvp('e1', 'u1', 'buyer')).resolves.toBeUndefined();
    expect(lastBuilder.upsert).toHaveBeenCalled();
  });

  it('removeRsvp requires an event and user', async () => {
    await expect(removeRsvp(null, 'u1')).rejects.toThrow();
  });
});
