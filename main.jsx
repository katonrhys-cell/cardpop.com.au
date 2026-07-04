
// Must come first: registers the Trusted Types default policy before any code
// touches a DOM XSS sink (the enforced CSP requires Trusted Types for scripts).
import '@/lib/trustedTypesPolicy.js';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import '@/index.css';
import '@/global.css';

// The homepage ships its full stylesheet as media="print" (non-render-blocking,
// with critical above-the-fold CSS inlined in the HTML head) so it never delays
// first paint. Activate it as soon as the bundle runs. Other routes don't carry
// this marker, so this is a harmless no-op there. Done here (not via an inline
// onload handler) to keep the hardened CSP's script-src free of 'unsafe-inline'.
if (typeof document !== 'undefined') {
  for (const link of document.querySelectorAll('link[data-async-style]')) link.media = 'all';
}

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

// Register Service Worker for offline support and caching (deferred until idle)
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[SW] Service Worker registered');
        // Check for updates every hour
        setInterval(() => reg.update(), 60 * 60 * 1000);
      }).catch((err) => {
        console.warn('[SW] Service Worker registration failed:', err);
      });
    });
  }
};

// Error monitoring is deferred until the browser is idle so the ~87 kB (gzip)
// Sentry SDK — replay + tracing included — never blocks first paint. The React
// ErrorBoundary still catches render crashes during the brief pre-init window.
const initSentry = () => {
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN || 'https://7dfd1130af7b40d7d508a4902e85a1d9@o4511534905884672.ingest.us.sentry.io/4511534921416704',
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
        ],
        tracesSampleRate: 0.2,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        environment: import.meta.env.MODE || 'production',
      });
    })
    .catch(() => { /* monitoring is non-critical — never block the app on it */ });
};

// Third-party analytics + affiliate tags. These add no first-paint value, so we
// load them only after the app is interactive — keeping their ~90 kB of parse/
// execute off the critical path cuts main-thread work and long tasks during load.
const GA_MEASUREMENT_ID = 'G-NCZ6K9VFF8';
const loadThirdPartyScripts = () => {
  // Skip in dev and on localhost hosts (local `vite preview`, e2e/CI). On those
  // hosts the analytics/affiliate CDNs are unreachable or proxied to an HTML
  // error body that the browser tries to execute as JS, and they add no value
  // off a real deployment anyway. Mirrors the analyticsEnabled gate above.
  if (!import.meta.env.PROD || !analyticsEnabled) return;

  // Google Analytics (gtag.js)
  try {
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);
    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(gtagScript);
  } catch { /* analytics is non-critical */ }

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
  // Register service worker after page load for offline support
  registerServiceWorker();

  // Defer error monitoring and third-party tags until the browser is idle so
  // none of them block first paint or hydration.
  const initDeferred = () => { initSentry(); loadThirdPartyScripts(); };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(initDeferred, { timeout: 5000 });
  } else {
    window.setTimeout(initDeferred, 3000);
  }
}
