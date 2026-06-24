import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: mockFetch } }));

import { useApiHealth } from '@/hooks/useApiHealth.js';

beforeEach(() => vi.clearAllMocks());

describe('useApiHealth', () => {
  it('reports healthy when /health responds ok', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useApiHealth());
    await waitFor(() => expect(result.current.isHealthy).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.lastChecked).toBeInstanceOf(Date);
    expect(mockFetch).toHaveBeenCalledWith('/health', expect.objectContaining({ method: 'GET' }));
  });

  it('reports unhealthy with the status when the server errors', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    const { result } = renderHook(() => useApiHealth());
    await waitFor(() => expect(result.current.isHealthy).toBe(false));
    expect(result.current.error).toMatch(/HTTP 503/);
  });

  it('reports unhealthy when the request rejects', async () => {
    mockFetch.mockRejectedValue(new Error('connection refused'));
    const { result } = renderHook(() => useApiHealth());
    await waitFor(() => expect(result.current.isHealthy).toBe(false));
    expect(result.current.error).toBe('connection refused');
  });

  it('recheck re-runs the health probe', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useApiHealth());
    await waitFor(() => expect(result.current.isHealthy).toBe(true));

    mockFetch.mockClear();
    await act(async () => { result.current.recheck(); });
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  });
});
