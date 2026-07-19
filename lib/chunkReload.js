// Automatic recovery from stale lazy-loaded chunk failures after a deploy.
//
// The app is a Vite SPA whose route components are content-hashed and lazily
// imported (see App.jsx), served behind a catch-all rewrite
// ("/(.*)" → /app.html in vercel.json). After a new deploy the previous build's
// chunk files are gone, so a returning visitor whose cached app shell still
// points at the OLD hashes requests e.g. /assets/MarketplacePage-<oldhash>.js —
// which no longer exists. The SPA fallback answers with app.html
// (Content-Type: text/html), so the dynamic import fails with one of the
// messages below and the route never renders. This is what made /marketplace
// "fail to load" for returning (logged-in) users while a fresh/incognito
// (logged-out) visitor — with no cached shell — loaded fine.
//
// The durable fix is the service worker booting the shell network-first
// (public/sw.js). This guard is the belt-and-braces net for the window before
// the updated worker takes control, and for any other stale-chunk race: on the
// first such failure it purges the caches + service worker and reloads once to
// pull the live build. A short time-based cooldown prevents a reload loop when
// the error is not deploy-related (a genuinely broken chunk would otherwise
// reload forever).

export const STALE_CHUNK_RE = /(Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|'text\/html' is not a valid JavaScript MIME type|Unexpected token '<'|ChunkLoadError|Loading chunk \d+ failed)/i;

const RELOAD_TS_KEY = 'cardpop-chunk-reload-ts';
const RELOAD_COOLDOWN_MS = 15000;

export const isStaleChunkError = (message) => !!message && STALE_CHUNK_RE.test(message);

// Benign service-worker lifecycle noise. These fire from the browser's SW
// machinery during registration/update races (e.g. a new worker installing over
// an old one, or the /sw.js fetch losing a race with a redeploy). The
// registration call in main.jsx already .catch()es and console.warns them, and
// they never break the page — so they're pure noise in Sentry.
export const BENIGN_SW_NOISE_RE = /(newestWorker is null|Script .*\/sw\.js load failed|ServiceWorker script .* load failed|Rejected load of|The operation is insecure)/i;

/**
 * Sentry `beforeSend` filter. Drops errors the app already recovers from or that
 * are known-benign browser noise, so the Sentry dashboard reflects real,
 * user-impacting problems instead of deploy churn:
 *   • stale-chunk import failures — auto-recovered by installChunkReloadGuard
 *     (purge caches + reload once), so the user never sees a broken page.
 *   • service-worker lifecycle races — caught/warned at registration, harmless.
 *
 * Returns `null` to drop the event, or the event unchanged to keep it. Reads the
 * original thrown value from the hint first (most reliable), then falls back to
 * the serialised exception value / message on the event.
 */
export const dropRecoveredErrors = (event, hint) => {
  const original = hint?.originalException;
  const message =
    (typeof original === 'string' ? original : original?.message) ||
    event?.exception?.values?.[0]?.value ||
    (typeof event?.message === 'string' ? event.message : '') ||
    '';
  if (isStaleChunkError(message)) return null;
  if (message && BENIGN_SW_NOISE_RE.test(message)) return null;
  return event;
};

const readLastReload = () => {
  try {
    return Number(sessionStorage.getItem(RELOAD_TS_KEY)) || 0;
  } catch {
    return 0; // sessionStorage can be unavailable (privacy mode, sandboxed frame)
  }
};

const purgeAndReload = async () => {
  // If we reloaded very recently the fresh build didn't resolve it, so this is
  // not a stale-chunk problem — stop, or we'd loop forever.
  if (Date.now() - readLastReload() < RELOAD_COOLDOWN_MS) return;
  try {
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
  } catch {
    /* best-effort; without the guard we still gate on the cooldown next time */
  }

  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* best-effort — reload regardless so the browser refetches from network */
  }

  window.location.reload();
};

/**
 * Register global listeners that detect a stale-chunk import failure and
 * recover by purging caches/the service worker and reloading once. Safe to
 * call in any environment; a no-op when `window` is unavailable (SSR/tests).
 */
export const installChunkReloadGuard = () => {
  if (typeof window === 'undefined') return;

  // Thrown errors and resource (<script>) load failures both surface here.
  window.addEventListener('error', (event) => {
    const message = event?.message || event?.error?.message || '';
    if (isStaleChunkError(message)) purgeAndReload();
  }, true);

  // React.lazy import rejections that escape the error boundary arrive here
  // (Sentry recorded these under onunhandledrejection).
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const message = typeof reason === 'string' ? reason : (reason?.message || '');
    if (isStaleChunkError(message)) purgeAndReload();
  });
};
