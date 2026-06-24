import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useIsMounted } from '@/hooks/useIsMounted.js';

describe('useIsMounted', () => {
  it('reports true while mounted and false after unmount', () => {
    const { result, unmount } = renderHook(() => useIsMounted());
    expect(result.current()).toBe(true);
    unmount();
    expect(result.current()).toBe(false);
  });

  it('returns a stable callback across re-renders', () => {
    const { result, rerender } = renderHook(() => useIsMounted());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
