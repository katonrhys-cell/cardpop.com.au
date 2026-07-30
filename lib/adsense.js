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
