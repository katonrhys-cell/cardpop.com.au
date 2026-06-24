import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ items: [] }));
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: h.items, error: null }) }) }) },
}));
const authState = vi.hoisted(() => ({ currentUser: { id: 'u1' } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => authState }));

import { useCollectionStats } from '@/hooks/useCollectionStats.js';

beforeEach(() => {
  vi.clearAllMocks();
  h.items = [];
  authState.currentUser = { id: 'u1' };
  localStorage.clear();
});

describe('useCollectionStats', () => {
  it('is not loading and keeps defaults without a user', async () => {
    authState.currentUser = null;
    const { result } = renderHook(() => useCollectionStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats.totalCards).toBe(0);
  });

  it('computes totals, value and tradeable count', async () => {
    h.items = [
      { id: 'a', estimated_value_aud: 100, trade_value_locked: true },
      { id: 'b', estimated_value_aud: 50, trade_value_locked: false },
      { id: 'c', estimated_value_aud: 25, trade_value_locked: true },
    ];
    const { result } = renderHook(() => useCollectionStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats.totalCards).toBe(3);
    expect(result.current.stats.collectionValue).toBe(175);
    expect(result.current.stats.cardsForTrade).toBe(2);
  });

  it('derives growth from the stored value history', async () => {
    localStorage.setItem('vault_value_history_u1', JSON.stringify([{ date: '2026-01-01T00:00:00Z', value: 100 }]));
    h.items = [{ id: 'a', estimated_value_aud: 150, trade_value_locked: false }];
    const { result } = renderHook(() => useCollectionStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats.growthPercentage).toBe(50); // (150-100)/100
    expect(result.current.stats.isGrowing).toBe(true);
  });

  it('persists the current value into the history', async () => {
    h.items = [{ id: 'a', estimated_value_aud: 200, trade_value_locked: false }];
    const { result } = renderHook(() => useCollectionStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const stored = JSON.parse(localStorage.getItem('vault_value_history_u1'));
    expect(stored[stored.length - 1].value).toBe(200);
  });
});
