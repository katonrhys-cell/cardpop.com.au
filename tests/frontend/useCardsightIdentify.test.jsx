import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: mockFetch } }));

import { useCardsightIdentify } from '@/hooks/useCardsightIdentify.js';

const file = () => new File([new Uint8Array([1, 2, 3])], 'card.jpg', { type: 'image/jpeg' });

beforeEach(() => vi.clearAllMocks());

describe('useCardsightIdentify', () => {
  it('is a no-op without a file', async () => {
    const { result } = renderHook(() => useCardsightIdentify());
    await act(async () => { await result.current.identifyCard(null); });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('stores the top detection on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ detections: [{ name: 'Charizard' }, { name: 'Other' }] }) });
    const { result } = renderHook(() => useCardsightIdentify());
    await act(async () => { await result.current.identifyCard(file()); });
    expect(result.current.identifyResult).toEqual({ name: 'Charizard' });
    expect(result.current.identifyError).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith('/cardsight/identify', expect.objectContaining({ method: 'POST' }));
  });

  it('falls back to the raw payload when there are no detections', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ identified: false }) });
    const { result } = renderHook(() => useCardsightIdentify());
    await act(async () => { await result.current.identifyCard(file()); });
    expect(result.current.identifyResult).toEqual({ identified: false });
  });

  it('captures the error message on a failed response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: 'service down' }) });
    const { result } = renderHook(() => useCardsightIdentify());
    await act(async () => { await result.current.identifyCard(file()); });
    expect(result.current.identifyError).toBe('service down');
    expect(result.current.identifyResult).toBeNull();
  });

  it('clearIdentify resets result and error', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ detections: [{ name: 'X' }] }) });
    const { result } = renderHook(() => useCardsightIdentify());
    await act(async () => { await result.current.identifyCard(file()); });
    act(() => { result.current.clearIdentify(); });
    expect(result.current.identifyResult).toBeNull();
    expect(result.current.identifyError).toBeNull();
  });
});
