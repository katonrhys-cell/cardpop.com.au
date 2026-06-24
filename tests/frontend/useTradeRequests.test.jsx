import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ result: { data: [], error: null }, single: { data: null, error: null } }));
const calls = vi.hoisted(() => ({ insert: [], update: [] }));

vi.mock('@/lib/supabaseClient.js', () => {
  function builder() {
    const b = {
      select: () => b,
      insert: (a) => { calls.insert.push(a); return b; },
      update: (a) => { calls.update.push(a); return b; },
      match: () => b, eq: () => b, neq: () => b, or: () => b, not: () => b, order: () => b,
      single: () => Promise.resolve(h.single),
      then: (res, rej) => Promise.resolve(h.result).then(res, rej),
    };
    return b;
  }
  return { supabase: { from: () => builder() } };
});
const authState = vi.hoisted(() => ({ currentUser: { id: 'me' } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => authState }));
const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: mockToast }));

import { useTradeRequests } from '@/hooks/useTradeRequests.js';

beforeEach(() => {
  vi.clearAllMocks();
  h.result = { data: [], error: null };
  h.single = { data: null, error: null };
  calls.insert = []; calls.update = [];
  authState.currentUser = { id: 'me' };
});

describe('useTradeRequests', () => {
  it('getMyTradesSent returns proposed trades', async () => {
    h.result = { data: [{ id: 't1' }], error: null };
    const { result } = renderHook(() => useTradeRequests());
    let trades;
    await act(async () => { trades = await result.current.getMyTradesSent(); });
    expect(trades).toEqual([{ id: 't1' }]);
  });

  it('getMyTradesReceived returns an empty list without a user', async () => {
    authState.currentUser = null;
    const { result } = renderHook(() => useTradeRequests());
    let trades;
    await act(async () => { trades = await result.current.getMyTradesReceived(); });
    expect(trades).toEqual([]);
  });

  it('acceptTrade marks accepted, cancels conflicts and toasts success', async () => {
    h.result = { data: null, error: null };
    const { result } = renderHook(() => useTradeRequests());
    let ok;
    await act(async () => {
      ok = await result.current.acceptTrade({ id: 't1', initiator_listing_id: 'a', responder_listing_id: 'b' });
    });
    expect(ok).toBe(true);
    expect(calls.update[0]).toEqual({ status: 'accepted' });
    expect(calls.update[1]).toEqual({ status: 'cancelled' }); // conflict cancellation
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('acceptTrade returns false and toasts on error', async () => {
    h.result = { data: null, error: new Error('update failed') };
    const { result } = renderHook(() => useTradeRequests());
    let ok;
    await act(async () => { ok = await result.current.acceptTrade({ id: 't1' }); });
    expect(ok).toBe(false);
    expect(mockToast.error).toHaveBeenCalled();
  });

  it('declineTrade cancels the trade', async () => {
    h.result = { data: null, error: null };
    const { result } = renderHook(() => useTradeRequests());
    let ok;
    await act(async () => { ok = await result.current.declineTrade('t1'); });
    expect(ok).toBe(true);
    expect(calls.update[0]).toEqual({ status: 'cancelled' });
  });

  it('proposeTrade computes the cash top-up and records who pays it', async () => {
    h.single = { data: { id: 'new-trade' }, error: null };
    const { result } = renderHook(() => useTradeRequests());
    let created;
    await act(async () => {
      created = await result.current.proposeTrade({
        initiatorListingId: 'a', responderListingId: 'b', responderId: 'them',
        initiatorValue: 80, responderValue: 100, message: 'hi',
      });
    });
    expect(created).toEqual({ id: 'new-trade' });
    const payload = calls.insert[0];
    expect(payload.cash_topup_aud).toBe(20);       // |80 - 100|
    expect(payload.topup_required_from).toBe('me'); // initiator owes the lower side
  });

  it('proposeTrade returns null and toasts on insert error', async () => {
    h.single = { data: null, error: { message: 'insert failed' } };
    const { result } = renderHook(() => useTradeRequests());
    let created;
    await act(async () => {
      created = await result.current.proposeTrade({ initiatorValue: 10, responderValue: 10, responderId: 'them' });
    });
    expect(created).toBeNull();
    expect(mockToast.error).toHaveBeenCalledWith('insert failed');
  });
});
