import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Each from(table) returns a chainable builder resolving the per-table fixture.
const h = vi.hoisted(() => ({ tables: {}, rejectTable: null }));
vi.mock('@/lib/supabaseClient.js', () => {
  function builder(table) {
    const result = () => (h.rejectTable === table
      ? Promise.reject(new Error('boom'))
      : Promise.resolve({ data: h.tables[table] ?? null, error: null }));
    const b = {
      select: () => b, eq: () => b, order: () => b, limit: () => b,
      single: () => result(),
      then: (res, rej) => result().then(res, rej),
    };
    return b;
  }
  return { supabase: { from: vi.fn((t) => builder(t)) } };
});

import { useUserDetails } from '@/hooks/useUserDetails.js';

beforeEach(() => {
  vi.clearAllMocks();
  h.tables = {};
  h.rejectTable = null;
});

describe('useUserDetails', () => {
  it('is not loading and has no user without a userId', async () => {
    const { result } = renderHook(() => useUserDetails(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('aggregates profile, vault, orders, reviews and addresses', async () => {
    h.tables = {
      profiles: { id: 'u1', username: 'ada' },
      vault_items: [{ id: 'v1' }, { id: 'v2' }],
      orders: [{ id: 'o1' }],            // both buyer/seller queries hit `orders`
      reviews: [{ id: 'r1' }],
      shipping_addresses: [{ id: 'a1' }],
    };
    const { result } = renderHook(() => useUserDetails('u1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual({ id: 'u1', username: 'ada' });
    expect(result.current.vaultProducts).toHaveLength(2);
    expect(result.current.ordersAsBuyer).toHaveLength(1);
    expect(result.current.ordersAsSeller).toHaveLength(1);
    expect(result.current.reviews).toHaveLength(1);
    expect(result.current.addresses).toHaveLength(1);
  });

  it('degrades gracefully when one source fails (allSettled)', async () => {
    h.tables = { profiles: { id: 'u1' }, vault_items: [{ id: 'v1' }] };
    h.rejectTable = 'reviews';
    const { result } = renderHook(() => useUserDetails('u1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual({ id: 'u1' });
    expect(result.current.reviews).toEqual([]); // failed source → empty
  });
});
