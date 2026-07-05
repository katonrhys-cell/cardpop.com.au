import { useState, useEffect } from 'react';

// Desktop breakpoint mirrors Tailwind's `lg` (1024px), which is where the
// Header switches from the hamburger Sheet to the Row-2 mega-dropdown nav.
const DESKTOP_QUERY = '(min-width: 1024px)';

// Returns true on lg+ viewports. Seeded synchronously from window.innerWidth so
// the very first render is already correct (no SSR here — this is a client SPA),
// which lets the Header avoid even mounting the desktop-nav lazy chunk on phones.
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_QUERY).matches : true,
  );

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}
