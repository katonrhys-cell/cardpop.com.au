import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: mockFetch } }));

import { useCardsightPricing } from '@/hooks/useCardsightPricing.js';

const ok = (body) => ({ ok: true, json: async () => body });

beforeEach(() => vi.clearAllMocks());

describe('useCardsightPricing', () => {
  it('fetchPricingById stores pricing keyed by card id', async () => {
    mockFetch.mockResolvedValue(ok({ avg_price: 100 }));
    const { result } = renderHook(() => useCardsightPricing());
    await act(async () => { await result.current.fetchPricingById('card-1'); });
    expect(result.current.csPrice).toEqual({ cardId: 'card-1', avg_price: 100 });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/cardsight/pricing/card-1'));
  });

  it('fetchPricingById is a no-op without a card id', async () => {
    const { result } = renderHook(() => useCardsightPricing());
    await act(async () => { await result.current.fetchPricingById(); });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetchPricingById leaves price null when the request is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    const { result } = renderHook(() => useCardsightPricing());
    await act(async () => { await result.current.fetchPricingById('card-1'); });
    expect(result.current.csPrice).toBeNull();
  });

  it('fetchPricingByName stores pricing only when there are results', async () => {
    mockFetch.mockResolvedValue(ok({ count: 5, avg_price: 80 }));
    const { result } = renderHook(() => useCardsightPricing());
    await act(async () => { await result.current.fetchPricingByName('Charizard'); });
    expect(result.current.csPrice).toEqual({ cardId: null, count: 5, avg_price: 80 });
  });

  it('fetchPricingByName ignores empty results', async () => {
    mockFetch.mockResolvedValue(ok({ count: 0 }));
    const { result } = renderHook(() => useCardsightPricing());
    await act(async () => { await result.current.fetchPricingByName('Obscure'); });
    expect(result.current.csPrice).toBeNull();
  });

  it('clearCsPrice resets stored pricing', async () => {
    mockFetch.mockResolvedValue(ok({ avg_price: 1 }));
    const { result } = renderHook(() => useCardsightPricing());
    await act(async () => { await result.current.fetchPricingById('c'); });
    act(() => { result.current.clearCsPrice(); });
    expect(result.current.csPrice).toBeNull();
  });
});
