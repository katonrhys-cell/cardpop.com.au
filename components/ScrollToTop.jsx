import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Attempt immediate scroll, then retry on the next frame in case
    // overflow:hidden was just cleared by the Header's body-style failsafe
    // (stale overflow from an unmounted Radix Dialog would block scrollTo).
    window.scrollTo(0, 0);
    const raf = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}