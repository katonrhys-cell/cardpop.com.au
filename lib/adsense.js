// Google AdSense loader.
//
// AdSense's own snippet is a static <script async src=… crossorigin> in the
// document <head>. That tag can't be used here: the enforced CSP uses
// `strict-dynamic` (vercel.json), which makes browsers ignore the host
// allowlist for markup-inserted scripts — a static tag in index.html would be
// blocked outright. A script this app creates is trusted transitively, so the
// snippet is injected from JS instead. Same URL, same client, same effect
// (Auto ads, site verification, and the in-article units in InArticleAd).
export const ADSENSE_CLIENT = 'ca-pub-8195080361704709';
export const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

// Loads adsbygoogle.js at most once per page, no matter how many callers ask
// for it — the site-wide load in main.jsx and every InArticleAd instance all
// funnel through here (multiple <script> tags would double-fetch and can
// trigger AdSense policy warnings for duplicate loaders).
let adsenseScriptPromise = null;

export const loadAdsenseScript = () => {
  if (typeof document === 'undefined') return Promise.resolve();
  if (adsenseScriptPromise) return adsenseScriptPromise;
  const existing = document.querySelector('script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
  if (existing) {
    adsenseScriptPromise = Promise.resolve();
    return adsenseScriptPromise;
  }
  adsenseScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = ADSENSE_SCRIPT_SRC;
    // Resolve either way: an ad blocker or an offline visitor must not leave
    // callers hanging on a promise that never settles.
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => resolve(), { once: true });
    document.head.appendChild(script);
  });
  return adsenseScriptPromise;
};

// Screens that carry no publisher content of their own — sign-in, account and
// admin tools, checkout, messaging, search results, the pre-launch capture page.
// AdSense policy forbids Google-served ads "on screens without publisher
// content", and its site review counts a page that is mostly a login form or a
// cart as low-value. Auto ads only ever land on pages outside this list.
const NO_AD_PREFIXES = [
  '/login', '/logout', '/signup', '/forgot-password', '/reset-password',
  '/verification-pending', '/verify-account', '/verify-identity',
  '/complete-profile', '/welcome', '/onboarding',
  '/account', '/profile', '/security', '/balance', '/transactions',
  '/sales-history', '/trade-requests', '/messaging',
  '/vault', '/my-vault', '/scan',
  '/admin', '/diagnostics',
  '/checkout', '/checkout-success', '/success',
  '/search', '/launch', '/data-deletion',
  '/partners/apply', '/community/discussion/new', '/card-shops/add',
];

export const isAdEligiblePath = (pathname = '/') => {
  const path = String(pathname).toLowerCase().replace(/\/+$/, '') || '/';
  return !NO_AD_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

// Off a real deployment (vite dev, local preview, e2e) the loader never runs —
// mirrors main.jsx's analyticsEnabled gate.
const adsEnabled = () => {
  if (!import.meta.env.PROD || typeof window === 'undefined') return false;
  return !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)$/.test(window.location.hostname);
};

// Loads the AdSense script off the critical path, but only on a page that may
// carry ads. Called once from main.jsx for the landing page, and again by
// AdsenseRouteLoader on every client-side navigation — so a visitor who lands
// on /login and then browses to an article still gets the loader there.
// Idle with a 5s timeout rather than waiting for interaction: AdSense's review
// crawler never scrolls or clicks (see main.jsx).
export const scheduleAdsenseLoad = (pathname) => {
  if (adsenseScriptPromise || !adsEnabled() || !isAdEligiblePath(pathname)) return;
  const load = () => {
    try { loadAdsenseScript(); } catch { /* ads are non-critical */ }
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(load, { timeout: 5000 });
  } else {
    window.setTimeout(load, 1500);
  }
};
