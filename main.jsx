
// Must come first: registers the Trusted Types default policy before any code
// touches a DOM XSS sink (the enforced CSP requires Trusted Types for scripts).
import '@/lib/trustedTypesPolicy.js';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import { installChunkReloadGuard, dropRecoveredErrors } from '@/lib/chunkReload.js';
import { installImageCdnFallback } from '@/utils/imageCdnFallback.js';
import { installWebMcp } from '@/lib/webmcp.js';
import { GA_MEASUREMENT_ID, installGtag } from '@/lib/analytics.js';
import { initMetaPixel } from '@/lib/metaPixel.js';
import { scheduleAdsenseLoad } from '@/lib/adsense.js';
import { onFirstInteractionOrLoad } from '@/lib/deferredLoad.js';
import { prefetchHomepageData } from '@/lib/homepageData.js';
import '@/index.css';
import '@/global.css';

// Capture the Supabase password-recovery marker before the client's
// detectSessionInUrl consumes and clears the URL hash. The reset page is
// lazy-loaded and mounts after the hash is already gone and PASSWORD_RECOVERY
// has fired, so it can't read either — stash a flag it picks up on mount. This
// synchronous read runs before any async step inside the client's initialize()
// clears the hash (see pages/PasswordResetPage.jsx).
try {
  if (window.location.hash.includes('type=recovery')) {
    sessionStorage.setItem('cardpop_password_recovery', '1');
  }
} catch { /* sessionStorage blocked (privacy mode) — the page's own checks still run */ }

// Auto-recover if an out-of-date app shell requests a lazy-chunk hash that no
// longer exists after a deploy (see lib/chunkReload.js). Installed first so the
// listeners are in place before any route chunk is imported.
installChunkReloadGuard();

// If the image CDN (img.cardpop.com.au) fails to serve an object, fall images
// back to the Supabase origin so a CDN incident doesn't leave broken thumbnails
// across the site (see utils/imageCdnFallback.js). Installed before first paint
// so the listener catches the earliest image loads.
installImageCdnFallback();

// Expose safe, read-only site actions (search, section navigation) to
// WebMCP-capable in-browser AI agents. A no-op in browsers without
// navigator.modelContext, so it never affects normal visitors (see
// lib/webmcp.js).
installWebMcp();

// The homepage ships its full stylesheet as media="print" (non-render-blocking,
// with critical above-the-fold CSS inlined in the HTML head) so it never delays
// first paint. Activate it as soon as the bundle runs. Other routes don't carry
// this marker, so this is a harmless no-op there. Done here (not via an inline
// onload handler) to keep the hardened CSP's script-src free of 'unsafe-inline'.
//
// Returns a promise that resolves once every activated stylesheet has finished
// loading, so the first React render can wait for it. Without the wait, the JS
// bundle can win the race against the (low-priority, media="print") CSS fetch
// on a cold cache: React then mounts the full header/footer with only the
// inlined critical CSS — a flash of unstyled content until the sheet lands.
// The static shell stays on screen while we wait, so nothing looks stalled.
const activateDeferredStylesheets = () => {
  if (typeof document === 'undefined') return Promise.resolve();
  const pending = [];
  for (const link of document.querySelectorAll('link[data-async-style]')) {
    link.media = 'all';
    if (!link.sheet) {
      pending.push(new Promise((resolve) => {
        link.addEventListener('load', resolve, { once: true });
        link.addEventListener('error', resolve, { once: true });
      }));
    }
  }
  return Promise.all(pending);
};

// Lazy-load Analytics and SpeedInsights to defer their JS loading
const Analytics = React.lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })));
const SpeedInsights = React.lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })));

// These inject /_vercel/{insights,speed-insights}/script.js, which only exist on
// a Vercel deployment. On localhost (local `vite preview`, e2e/CI) those paths
// 404 and the SPA fallback returns index.html, so the browser tries to execute
// HTML as JS ("Unexpected token '<'"). Skip them off-deployment; they still run
// on every real Vercel host (production and *.vercel.app previews).
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const analyticsEnabled = !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)$/.test(hostname);

const renderApp = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <>
      <App />
      {analyticsEnabled && (
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      )}
      {analyticsEnabled && (
        <Suspense fallback={null}>
          <SpeedInsights />
        </Suspense>
      )}
    </>
  );
};

// Mount only after the deferred stylesheet is applied (see above). Routes with
// no [data-async-style] link (app.html, dev server) resolve immediately, so
// this adds zero delay there. The 2s race is a fail-safe: if the CSS fetch
// stalls or errors, the app still boots rather than staying a static shell.
Promise.race([
  activateDeferredStylesheets(),
  new Promise((resolve) => setTimeout(resolve, 2000)),
]).then(renderApp);

// Register Service Worker for offline support and caching (deferred until idle)
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      // The SW file is static, so the image CDN host (a build-time env var)
      // is handed over via the registration URL — sw.js reads ?cdn=<host> and
      // routes canonical Supabase storage image fetches through the CDN.
      const cdnHost = import.meta.env.VITE_IMAGE_CDN_HOST;
      const swUrl = cdnHost ? `/sw.js?cdn=${encodeURIComponent(cdnHost)}` : '/sw.js';
      navigator.serviceWorker.register(swUrl).then((reg) => {
        console.log('[SW] Service Worker registered');
        // Check for updates every hour. reg.update() rejects on any transient
        // network failure (offline laptop, dropped connection, CDN hiccup) with
        // "An unknown error occurred when fetching the script" — harmless, since
        // the already-installed worker keeps serving. Without this catch the
        // rejection is unhandled and Sentry's onunhandledrejection handler
        // reports it as a production error. Skip the check outright when the
        // browser knows it's offline.
        setInterval(() => {
          if (navigator.onLine === false) return;
          reg.update().catch((err) => {
            console.warn('[SW] Service Worker update check failed:', err);
          });
        }, 60 * 60 * 1000);
      }).catch((err) => {
        console.warn('[SW] Service Worker registration failed:', err);
      });
    });
  }
};

// Error monitoring is deferred until the visitor first interacts (or, failing
// that, a few seconds after `load` — see lib/deferredLoad.js), or until the
// first error, whichever comes first. The SDK (~47 kB gzip, ~125 ms of parse
// and execute on a mid-range phone) was previously loaded at idle, which still
// landed it inside the initial load window that PageSpeed Insights measures:
// it was the largest single "Reduce unused JavaScript" entry and a long task
// of its own. Nothing is lost by waiting — errors thrown before the SDK is up
// are buffered by the listeners below and reported the moment it initialises.
//
// Session Replay is deliberately NOT enabled: referencing replayIntegration
// pulls ~150 kB (~50 kB gzip) of extra SDK into the bundle and was the single
// biggest "unused JavaScript" / "legacy JavaScript" line in PageSpeed Insights.
// Error events and performance traces still flow; only the pixel-level session
// recordings are gone. If replays are ever needed again, prefer
// Sentry.lazyLoadIntegration('replayIntegration') over re-adding it here.
const PRE_INIT_ERROR_CAP = 20;
const preInitErrors = [];
let sentryStarted = false;
const initSentry = () => {
  if (sentryStarted) return;
  sentryStarted = true;
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN || 'https://7dfd1130af7b40d7d508a4902e85a1d9@o4511534905884672.ingest.us.sentry.io/4511534921416704',
        integrations: [
          Sentry.browserTracingIntegration(),
        ],
        tracesSampleRate: 0.2,
        environment: import.meta.env.MODE || 'production',
        // Drop errors the app already auto-recovers from (stale-chunk imports
        // handled by installChunkReloadGuard) and benign service-worker
        // lifecycle noise, so the dashboard surfaces real, user-impacting bugs
        // instead of deploy churn. See lib/chunkReload.js.
        beforeSend: dropRecoveredErrors,
      });
      // Replay anything that went wrong before the SDK was up. beforeSend still
      // filters these, so a recovered stale-chunk reload is dropped as usual.
      for (const err of preInitErrors.splice(0)) {
        try { Sentry.captureException(err, { tags: { pre_init: 'true' } }); } catch { /* best-effort */ }
      }
    })
    .catch(() => { /* monitoring is non-critical — never block the app on it */ });
};

// Buffer early errors and bring the SDK up at once when one happens, so a
// crash on first paint is never silently lost to the deferral above.
const bufferPreInitError = (err) => {
  if (sentryStarted) return;
  if (preInitErrors.length < PRE_INIT_ERROR_CAP) preInitErrors.push(err);
  initSentry();
};

// Third-party analytics + affiliate tags. These add no first-paint value, so we
// load them only after the app is interactive — keeping their ~90 kB of parse/
// execute off the critical path cuts main-thread work and long tasks during load.
const loadThirdPartyScripts = () => {
  // Skip in dev and on localhost hosts (local `vite preview`, e2e/CI). On those
  // hosts the analytics/affiliate CDNs are unreachable or proxied to an HTML
  // error body that the browser tries to execute as JS, and they add no value
  // off a real deployment anyway. Mirrors the analyticsEnabled gate above.
  if (!import.meta.env.PROD || !analyticsEnabled) return;

  // Google Analytics (gtag.js). The dataLayer/gtag command queue is installed
  // at boot (see below) so page_views recorded before this script loads are
  // replayed in order; this only injects the script itself.
  try {
    installGtag();
    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(gtagScript);
  } catch { /* analytics is non-critical */ }

  // Cloudflare Web Analytics (RUM beacon). Loaded here instead of Cloudflare's
  // edge auto-injection: the auto-injected snippet carries no nonce/hash, so the
  // `strict-dynamic` CSP blocks it — a script this app creates is trusted
  // transitively. Requires the site token (Cloudflare dashboard → Web Analytics)
  // and the dashboard auto-injection to be switched OFF; unset token = skipped.
  const cfBeaconToken = import.meta.env.VITE_CF_BEACON_TOKEN;
  if (cfBeaconToken) {
    try {
      const cfScript = document.createElement('script');
      cfScript.defer = true;
      cfScript.src = 'https://static.cloudflareinsights.com/beacon.min.js';
      cfScript.setAttribute('data-cf-beacon', JSON.stringify({ token: cfBeaconToken }));
      document.head.appendChild(cfScript);
    } catch { /* analytics is non-critical */ }
  }

  // Impact affiliate tracking
  try {
    (function (i, m, p, a, c, t) {
      c.ire_o = p; c[p] = c[p] || function () { (c[p].a = c[p].a || []).push(arguments); };
      t = a.createElement(m); const z = a.getElementsByTagName(m)[0];
      t.async = 1; t.src = i; z.parentNode.insertBefore(t, z);
    })('https://utt.impactcdn.com/P-A7361090-8367-4d02-a53d-c4f13bef08391.js', 'script', 'impactStat', document, window);
    window.impactStat('transformLinks');
    window.impactStat('trackImpression');
  } catch { /* affiliate tracking is non-critical */ }
};

if (typeof window !== 'undefined') {
  // Install the GA4 command queue immediately (stub only — no network, ~0 cost)
  // so the landing page_view and any pre-interaction navigations recorded by
  // AnalyticsPageViews queue up and replay in order once gtag.js loads below.
  if (import.meta.env.PROD && analyticsEnabled) {
    try { installGtag(); } catch { /* analytics is non-critical */ }
    // Meta Pixel: dormant until VITE_META_PIXEL_ID is set and the visitor
    // accepts marketing cookies (lib/consent.js); installs itself on consent.
    try { initMetaPixel(); } catch { /* pixel is non-critical */ }
  }

  // Start the homepage's Supabase reads NOW, before React boots. They used to
  // begin only once HomePage mounted (entry parse → providers → route chunk →
  // effect), which put the React mount on the critical path of every card
  // photo on the page — the longest chain in PageSpeed's network dependency
  // tree. The page component reads the same cached promises (lib/queryCache),
  // so nothing is fetched twice.
  if (window.location.pathname === '/') {
    try { prefetchHomepageData(); } catch { /* HomePage fetches on mount regardless */ }
  }

  // Register service worker after page load for offline support
  registerServiceWorker();

  // Error monitoring: first interaction, a few seconds after load, or the
  // first error — see initSentry above.
  window.addEventListener('error', (event) => {
    bufferPreInitError(event?.error ?? new Error(String(event?.message || 'Unknown error')));
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    bufferPreInitError(reason instanceof Error ? reason : new Error(String(reason)));
  });
  onFirstInteractionOrLoad(initSentry);

  // Google AdSense loader (adsbygoogle.js), site-wide. AdSense publishes this
  // as a static <script> for the document <head>, but the `strict-dynamic` CSP
  // blocks markup-inserted third-party scripts — injecting it from here makes
  // it trusted transitively (same reasoning as the Cloudflare beacon). Loading
  // it on every content page, rather than only where an <ins> slot mounts, is what site
  // verification and Auto ads need. See lib/adsense.js.
  //
  // Deliberately NOT part of loadThirdPartyScripts() below: those tags wait for
  // the first pointerdown/keydown/touchstart/scroll, falling back to `load` + 4s.
  // AdSense's review crawler does none of those things, and on a page this heavy
  // `load` alone can land past a renderer's budget — so behind that gate the
  // snippet was never in the DOM Google actually saw, leaving the site stuck on
  // "Getting ready" (ad code not found) no matter how long we waited. Idle with a
  // 5s timeout still keeps it off the critical path for real visitors.
  //
  // Only on screens with publisher content — never on sign-in, account,
  // checkout or admin pages (see isAdEligiblePath in lib/adsense.js).
  if (analyticsEnabled) scheduleAdsenseLoad(window.location.pathname);

  // Analytics/affiliate tags wait for the first user interaction (or a few
  // seconds after `load` as a fallback for users who never touch the page —
  // see lib/deferredLoad.js for why that fallback sits past the window
  // Lighthouse measures). Loading them at idle still landed their ~200 kB of
  // parse/execute inside the initial load window on mid-range phones — the
  // largest third-party slice of PageSpeed's "Reduce unused JavaScript" and
  // main-thread work. A visitor's first pageview is still recorded; it just
  // arrives a moment later than the tag's own bootstrap would send it.
  onFirstInteractionOrLoad(loadThirdPartyScripts);
}
