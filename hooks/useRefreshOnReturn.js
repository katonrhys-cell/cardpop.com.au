import { useEffect, useRef } from 'react';

// Refresh a page's data when the visitor comes back to it, instead of holding
// a realtime channel open while they are away.
//
// Public grids (marketplace, shop, product pages, the live ticker) used to
// subscribe every visitor — signed in or not — to table-wide UPDATE events so
// the page could refetch when stock or a listing changed. Supabase Realtime
// polls the WAL for as long as *any* client holds a subscription, so a few
// anonymous tabs left open kept that poller running around the clock; it was
// the single largest consumer of database time on the project. The pages
// don't need a push: a visitor who is looking at the page sees the data they
// just loaded, and a visitor who tabbed away only needs it fresh when they
// return.
//
// `refresh` runs when the document becomes visible again (or the window
// regains focus) after at least `staleMs` away. Nothing fires while the page
// is in the foreground, and a quick alt-tab doesn't refetch.

export const DEFAULT_STALE_MS = 60_000;

export function useRefreshOnReturn(refresh, { staleMs = DEFAULT_STALE_MS, enabled = true } = {}) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;
    let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : null;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= staleMs) {
        refreshRef.current?.();
      }
      hiddenAt = null;
    };
    // Some browsers (and the embedded webviews) fire blur/focus without a
    // visibilitychange when the user switches apps; treat them the same way.
    // The window also blurs when focus moves into an embedded iframe (Stripe,
    // Turnstile, YouTube) — the visitor never left, so coming back out of the
    // frame must not refetch (and flash) the page. document.hasFocus() stays
    // true while a child frame holds focus; check it once the blur settles.
    let blurTimer = null;
    const onBlur = () => {
      const blurredAt = Date.now();
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (hiddenAt === null && !document.hasFocus()) hiddenAt = blurredAt;
      }, 0);
    };
    const onFocus = () => { if (document.visibilityState !== 'hidden') onVisibility(); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, staleMs]);
}

export default useRefreshOnReturn;
