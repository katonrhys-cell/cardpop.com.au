import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient', () => ({ apiServerClient: { fetch: mockFetch } }));

import { useEbayPriceLookup } from '@/hooks/useEbayPriceLookup.js';

const okResponse = (body) => ({ ok: true, json: async () => body });

beforeEach(() => vi.clearAllMocks());

describe('useEbayPriceLookup', () => {
  it('does nothing without a card name', async () => {
    const { result } = renderHook(() => useEbayPriceLookup());
    await act(async () => { await result.current.lookupPrice({}); });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.isLookingUp).toBe(false);
  });

  it('stores pricing when the lookup returns results', async () => {
    mockFetch.mockResolvedValue(okResponse({ count: 3, avgPrice: 100 }));
    const { result } = renderHook(() => useEbayPriceLookup());
    await act(async () => { await result.current.lookupPrice({ name: 'Charizard' }); });
    expect(result.current.priceData).toEqual({ count: 3, avgPrice: 100 });
    await waitFor(() => expect(result.current.isLookingUp).toBe(false));
  });

  it('ignores empty results (count 0)', async () => {
    mockFetch.mockResolvedValue(okResponse({ count: 0 }));
    const { result } = renderHook(() => useEbayPriceLookup());
    await act(async () => { await result.current.lookupPrice({ name: 'Obscure' }); });
    expect(result.current.priceData).toBeNull();
  });

  it('builds the query from name, set, grading service and grade', async () => {
    mockFetch.mockResolvedValue(okResponse({ count: 0 }));
    const { result } = renderHook(() => useEbayPriceLookup());
    await act(async () => {
      await result.current.lookupPrice({ name: 'Charizard', cardSetName: 'Base', gradingService: 'PSA', gradeScore: '10' });
    });
    const url = mockFetch.mock.calls[0][0];
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('name')).toBe('Charizard');
    expect(params.get('set')).toBe('Base');
    expect(params.get('gradingService')).toBe('PSA');
    expect(params.get('gradeScore')).toBe('10');
  });

  it('fails silently when the request throws', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useEbayPriceLookup());
    await act(async () => { await result.current.lookupPrice({ name: 'Charizard' }); });
    expect(result.current.priceData).toBeNull();
    expect(result.current.isLookingUp).toBe(false);
  });

  it('clearPrice resets stored pricing', async () => {
    mockFetch.mockResolvedValue(okResponse({ count: 1 }));
    const { result } = renderHook(() => useEbayPriceLookup());
    await act(async () => { await result.current.lookupPrice({ name: 'X' }); });
    expect(result.current.priceData).not.toBeNull();
    act(() => { result.current.clearPrice(); });
    expect(result.current.priceData).toBeNull();
  });
});
