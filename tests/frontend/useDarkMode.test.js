import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useDarkMode } from '@/hooks/useDarkMode.js';

const STORAGE_KEY = 'cardpop-theme';

function setSystemPrefersDark(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  setSystemPrefersDark(false);
});

describe('useDarkMode — initial state', () => {
  it('uses a saved "dark" preference', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.isDark).toBe(true);
  });

  it('uses a saved "light" preference', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.isDark).toBe(false);
  });

  it('falls back to the system preference when nothing is saved', () => {
    setSystemPrefersDark(true);
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.isDark).toBe(true);
  });
});

describe('useDarkMode — effects & toggle', () => {
  it('applies the dark class and persists when dark', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    renderHook(() => useDarkMode());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('removes the dark class and persists when light', () => {
    document.documentElement.classList.add('dark');
    localStorage.setItem(STORAGE_KEY, 'light');
    renderHook(() => useDarkMode());
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('toggle flips the theme and updates the DOM + storage', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.isDark).toBe(false);

    act(() => { result.current.toggle(); });
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

    act(() => { result.current.toggle(); });
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });
});
