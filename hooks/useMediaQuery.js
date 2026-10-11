import { useState, useEffect } from 'react';

// Generic matchMedia hook. Seeded synchronously (client-only SPA, no SSR) so
// the first render already knows the breakpoint — which lets a page skip
// building DOM for a layout that CSS would only hide anyway. `fallback` is
// what to assume where matchMedia is unavailable (tests, very old engines).
export function useMediaQuery(query, fallback = false) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return fallback;
    try { return window.matchMedia(query).matches; } catch { return fallback; }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    let mql;
    try { mql = window.matchMedia(query); } catch { return undefined; }
    const onChange = () => setMatches(mql.matches);
    onChange();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    // Safari < 14
    if (typeof mql.addListener === 'function') {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
    return undefined;
  }, [query]);

  return matches;
}

export default useMediaQuery;
