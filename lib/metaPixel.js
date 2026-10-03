// Meta (Facebook / Instagram) Pixel — dormant until VITE_META_PIXEL_ID is set
// AND the visitor has accepted marketing cookies (lib/consent.js). The script
// is injected from JS because the `strict-dynamic` CSP blocks markup-inserted
// third-party tags (same reasoning as lib/adsense.js).
//
// Standard events are sent through registerMetaSender() in lib/analytics.js, so
// a single call site (trackPurchase etc.) feeds GA4, Google Ads and Meta.

import { hasMarketingConsent, onConsentChange } from '@/lib/consent.js';
import { registerMetaSender } from '@/lib/analytics.js';

export const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '';
export const META_PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

let installed = false;

function installPixel() {
  if (installed || !META_PIXEL_ID || typeof window === 'undefined') return;
  installed = true;
  // Standard fbq bootstrap (queue first, script second).
  const w = window;
  if (!w.fbq) {
    const fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    w.fbq = fbq;
    if (!w._fbq) w._fbq = fbq;
  }
  w.fbq('init', META_PIXEL_ID);
  w.fbq('track', 'PageView');
  try {
    const s = document.createElement('script');
    s.async = true;
    s.src = META_PIXEL_SCRIPT_SRC;
    document.head.appendChild(s);
  } catch { /* non-critical */ }
  registerMetaSender((event, params, options) => {
    if (typeof w.fbq !== 'function') return;
    if (options) w.fbq('track', event, params, options);
    else w.fbq('track', event, params);
  });
}

/** Call once at boot (production only). Installs now if consented, else waits. */
export function initMetaPixel() {
  if (!META_PIXEL_ID || typeof window === 'undefined') return;
  if (hasMarketingConsent()) installPixel();
  else onConsentChange((v) => { if (v === 'all') installPixel(); });
}

/** SPA navigation: Meta counts PageView per route like GA does. */
export function trackMetaPageView() {
  if (!installed || typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq('track', 'PageView');
}
