// Google Analytics 4 (gtag.js) helpers.
//
// The gtag <script> itself is injected lazily — on first user interaction, see
// loadThirdPartyScripts in main.jsx — so it never competes with React
// hydration for the main thread. The command queue (window.dataLayer) is
// created here instead, synchronously at boot: gtag.js replays the queue in
// order when it finally loads, so the landing page and any routes the visitor
// touches *before* the script lands are still recorded correctly.

export const GA_MEASUREMENT_ID = 'G-NCZ6K9VFF8';

/**
 * Create window.dataLayer and the gtag() stub, and queue the base config.
 * Idempotent — safe to call again from the script loader.
 *
 * send_page_view is disabled: page_views are sent explicitly by
 * trackPageView() (components/AnalyticsPageViews.jsx) on the initial route
 * and on every SPA navigation. The automatic page_view would instead stamp
 * whatever route the visitor happens to be on when the lazily-loaded script
 * boots, misattributing the landing page. GA4's Enhanced Measurement
 * "page changes based on browser history events" must stay OFF in the GA
 * admin for the same reason — see docs/seo-analytics.md.
 */
export function installGtag() {
  if (typeof window === 'undefined' || typeof window.gtag === 'function') return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
}

/**
 * Record a GA4 page_view for the given path ("/pathname?query"). No-op when
 * the gtag stub was never installed (dev, localhost, e2e).
 */
export function trackPageView(path) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_location: window.location.origin + path,
    page_path: path,
    page_title: typeof document !== 'undefined' ? document.title : undefined,
  });
}
