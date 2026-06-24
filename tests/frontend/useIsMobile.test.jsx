import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useIsMobile } from '@/hooks/use-mobile.jsx';

let changeHandler;
function mockMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false, media: query, onchange: null,
    addEventListener: (_e, cb) => { changeHandler = cb; },
    removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  changeHandler = null;
  mockMatchMedia();
});

describe('useIsMobile', () => {
  it('is true below the mobile breakpoint', () => {
    window.innerWidth = 500;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('is false at or above the breakpoint', () => {
    window.innerWidth = 1024;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('updates when the media query change fires', () => {
    window.innerWidth = 1024;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => { window.innerWidth = 400; changeHandler?.(); });
    expect(result.current).toBe(true);
  });
});
