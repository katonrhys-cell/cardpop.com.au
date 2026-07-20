import { useState, useEffect } from 'react';

const STORAGE_KEY = 'cardpop-theme';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    // localStorage access throws in some privacy modes (blocked cookies /
    // old-Safari private mode). Header mounts this on every page, so an
    // unguarded throw here white-screens the whole app.
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) return saved === 'dark';
    } catch { /* fall through to system preference */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch { /* persisting the theme is best-effort */ }
  }, [isDark]);

  const toggle = () => setIsDark(prev => !prev);

  return { isDark, toggle };
}
