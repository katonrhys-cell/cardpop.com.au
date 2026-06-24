import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useMemoryCleanup } from '@/hooks/useMemoryCleanup.js';

describe('useMemoryCleanup', () => {
  it('runs the cleanup function once on unmount', () => {
    const cleanup = vi.fn();
    const { unmount } = renderHook(() => useMemoryCleanup(cleanup));
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('runs the latest cleanup function provided', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ fn }) => useMemoryCleanup(fn), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    unmount();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no function is given', () => {
    const { unmount } = renderHook(() => useMemoryCleanup(undefined));
    expect(() => unmount()).not.toThrow();
  });
});
