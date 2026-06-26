import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ fetchData: [], insertError: null, deleteError: null }));
const mockInsert = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient.js', () => {
  const chan = { on: vi.fn(() => chan), subscribe: vi.fn(() => chan) };
  return {
    supabase: {
      from: vi.fn(() => ({
        select: () => ({ eq: () => Promise.resolve({ data: h.fetchData, error: null }) }),
        insert: (...args) => { mockInsert(...args); return h.insertError ? Promise.reject(h.insertError) : Promise.resolve({ error: null }); },
        delete: () => ({ eq: () => ({ eq: (...args) => { mockDelete(...args); return h.deleteError ? Promise.reject(h.deleteError) : Promise.resolve({ error: null }); } }) }),
      })),
      channel: vi.fn(() => chan),
      removeChannel: vi.fn(),
    },
  };
});

const authState = vi.hoisted(() => ({ currentUser: { id: 'u1' }, isAuthenticated: true }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => authState }));

import { useWatchlist } from '@/hooks/useWatchlist.js';

beforeEach(() => {
  vi.clearAllMocks();
  h.fetchData = [];
  h.insertError = null;
  h.deleteError = null;
  authState.currentUser = { id: 'u1' };
  authState.isAuthenticated = true;
});

describe('useWatchlist', () => {
  it('loads the user\'s watchlisted ids', async () => {
    h.fetchData = [{ listing_id: 'l1' }, { listing_id: 'l2' }];
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(2);
    expect(result.current.isWatchlisted('l1')).toBe(true);
    expect(result.current.isWatchlisted('nope')).toBe(false);
  });

  it('is empty for an unauthenticated user', async () => {
    authState.isAuthenticated = false;
    authState.currentUser = null;
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(0);
  });

  it('adds a listing via insert when toggled on', async () => {
    h.fetchData = [];
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returned;
    await act(async () => { returned = await result.current.toggle('l9'); });
    // Returns { success, watchlisted } — success on a clean write, now watchlisted.
    expect(returned).toEqual({ success: true, watchlisted: true });
    expect(mockInsert).toHaveBeenCalledWith({ user_id: 'u1', listing_id: 'l9' });
  });

  it('removes a listing via delete when toggled off', async () => {
    h.fetchData = [{ listing_id: 'l1' }];
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.isWatchlisted('l1')).toBe(true));

    let returned;
    await act(async () => { returned = await result.current.toggle('l1'); });
    // A successful removal reports success:true (previously a bare false here was
    // ambiguous with failure).
    expect(returned).toEqual({ success: true, watchlisted: false });
    expect(mockDelete).toHaveBeenCalledWith('listing_id', 'l1');
  });

  it('reports failure and the prior state when the write fails', async () => {
    h.fetchData = [];
    h.insertError = new Error('write failed');
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returned;
    await act(async () => { returned = await result.current.toggle('l9'); });
    // Was not previously watchlisted; on failure success:false and state unchanged.
    expect(returned).toEqual({ success: false, watchlisted: false });
  });

  it('toggle is a no-op without a user', async () => {
    authState.currentUser = null;
    const { result } = renderHook(() => useWatchlist());
    let returned;
    await act(async () => { returned = await result.current.toggle('l1'); });
    expect(returned).toEqual({ success: false, watchlisted: false });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
