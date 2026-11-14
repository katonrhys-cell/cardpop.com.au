import { useEffect, useState } from 'react';

// Bars pinned to the bottom of the screen (the cookie banner, the phone "Buy"
// bar on product pages) publish their height here, and anything that floats in
// the bottom corner (the WhatsApp chat button) lifts itself by
// `var(--bottom-bar-inset)` so it never sits on top of them. Several bars can
// be up at once; the tallest wins, since they stack on the same edge.

export const BOTTOM_BAR_INSET_VAR = '--bottom-bar-inset';

const heights = new Map();

function publish() {
  if (typeof document === 'undefined') return;
  const tallest = Math.max(0, ...heights.values());
  const root = document.documentElement;
  if (tallest > 0) root.style.setProperty(BOTTOM_BAR_INSET_VAR, `${tallest}px`);
  else root.style.removeProperty(BOTTOM_BAR_INSET_VAR);
}

/** Record (or, with 0, clear) the height of the bottom bar named `key`. */
export function setBottomBarInset(key, px) {
  const height = Math.round(Number(px) || 0);
  if (height > 0) heights.set(key, height);
  else heights.delete(key);
  publish();
}

/**
 * Returns a ref callback for a bottom bar: while the element is mounted its
 * rendered height is published (0 when CSS hides it, e.g. `lg:hidden`), and
 * cleared when it unmounts.
 */
export function useBottomBarInset(key) {
  const [el, setEl] = useState(null);

  useEffect(() => {
    if (!el) return undefined;
    const update = () => setBottomBarInset(key, el.offsetHeight);
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      setBottomBarInset(key, 0);
    };
  }, [el, key]);

  return setEl;
}
