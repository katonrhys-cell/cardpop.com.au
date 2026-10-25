import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRefreshOnReturn, DEFAULT_STALE_MS } from '@/hooks/useRefreshOnReturn.js';

// Public grids no longer hold a realtime channel open; they refetch when the
// visitor comes back to the tab after being away a while. These pin that
// contract: nothing fires in the foreground, a quick alt-tab doesn't refetch,
// a long absence does — once.

const setVisibility = (value) => {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('useRefreshOnReturn', () => {
  beforeEach(() => { vi.useFakeTimers(); setVisibility('visible'); });
  afterEach(() => { vi.useRealTimers(); });

  it('refreshes once when the tab comes back after the stale window', () => {
    const refresh = vi.fn();
    renderHook(() => useRefreshOnReturn(refresh, { staleMs: 1000 }));
    expect(refresh).not.toHaveBeenCalled();

    act(() => { setVisibility('hidden'); });
    vi.advanceTimersByTime(1500);
    act(() => { setVisibility('visible'); });
    expect(refresh).toHaveBeenCalledTimes(1);

    // A second visible event with no hidden in between is a no-op.
    act(() => { setVisibility('visible'); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ignores a quick alt-tab', () => {
    const refresh = vi.fn();
    renderHook(() => useRefreshOnReturn(refresh, { staleMs: 1000 }));
    act(() => { setVisibility('hidden'); });
    vi.advanceTimersByTime(200);
    act(() => { setVisibility('visible'); });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('treats window blur / focus like hidden / visible', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const refresh = vi.fn();
    renderHook(() => useRefreshOnReturn(refresh, { staleMs: 1000 }));
    act(() => { window.dispatchEvent(new Event('blur')); });
    vi.advanceTimersByTime(5000);
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(refresh).toHaveBeenCalledTimes(1);
    document.hasFocus.mockRestore();
  });

  it('does not refresh when focus only moved into an embedded iframe', () => {
    // The window blurs when a Stripe/Turnstile/YouTube frame takes focus, but
    // the document still has focus — the visitor never left the page.
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const refresh = vi.fn();
    renderHook(() => useRefreshOnReturn(refresh, { staleMs: 1000 }));
    act(() => { window.dispatchEvent(new Event('blur')); });
    vi.advanceTimersByTime(5000);
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(refresh).not.toHaveBeenCalled();
    document.hasFocus.mockRestore();
  });

  it('calls the latest refresh function and can be disabled', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn, enabled }) => useRefreshOnReturn(fn, { staleMs: 10, enabled }), {
      initialProps: { fn: first, enabled: true },
    });
    rerender({ fn: second, enabled: true });
    act(() => { setVisibility('hidden'); });
    vi.advanceTimersByTime(50);
    act(() => { setVisibility('visible'); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    rerender({ fn: second, enabled: false });
    act(() => { setVisibility('hidden'); });
    vi.advanceTimersByTime(50);
    act(() => { setVisibility('visible'); });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('defaults to a one-minute stale window', () => {
    expect(DEFAULT_STALE_MS).toBe(60_000);
  });
});
