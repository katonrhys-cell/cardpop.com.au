import { lazy } from 'react';

// Wraps React.lazy so a failed dynamic import transparently recovers instead of
// crashing the route. Every page is code-split into a content-hashed chunk
// (assets/<Page>-<hash>.js); when a new deploy ships, the hashes change and the
// old chunk files are purged. A visitor still running the previous deploy's
// index.html then imports a filename that 404s → "Importing a module script
// failed". On the first such failure we force a one-time full reload, which
// re-fetches the current index.html and its fresh chunk references. A
// sessionStorage flag guards against a reload loop: if the import fails again
// right after reloading, the chunk is genuinely unreachable (offline, or a bad
// build) and we let it fall through to the ErrorBoundary.
const RETRY_FLAG = 'cardpop:chunk-reload';

// sessionStorage throws in private-mode / storage-disabled browsers — never let
// that turn a recoverable chunk error into an unhandled one.
const safeSession = {
  get(key) {
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch { /* storage unavailable */ }
  },
  remove(key) {
    try { window.sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
  },
};

export function lazyWithRetry(factory) {
  return lazy(() =>
    factory()
      .then((module) => {
        // Import succeeded — clear the guard so a later deploy in this same
        // session can trigger its own one-time recovery reload.
        safeSession.remove(RETRY_FLAG);
        return module;
      })
      .catch((error) => {
        if (!safeSession.get(RETRY_FLAG)) {
          safeSession.set(RETRY_FLAG, '1');
          window.location.reload();
          // Keep the Suspense fallback on screen for the instant before the
          // reload takes effect instead of resolving/rejecting.
          return new Promise(() => {});
        }
        // Second failure in a row: the reload didn't fix it. Surface the error.
        throw error;
      }),
  );
}
