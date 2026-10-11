// Google Customer Reviews (Merchant Center → Customer Reviews).
//
// Two pieces, both from Merchant Center's "Set up integration" page:
//   • the survey opt-in — shown on the order confirmation page, it asks the
//     buyer whether Google may email them a short survey after delivery;
//   • the badge — a small floating "Google Customer Reviews" seller rating.
//
// Google's snippets are static <script> tags. Those can't be used here: the CSP
// uses `strict-dynamic` (vercel.json), which ignores the host allowlist for
// markup-inserted scripts, so both loaders are injected from JS instead (a
// script this app creates is trusted transitively — same approach as
// lib/adsense.js). The script hosts are also on the Trusted Types allowlist in
// lib/trustedTypesPolicy.js.
import { onFirstInteractionOrLoad } from '@/lib/deferredLoad.js';

export const GCR_MERCHANT_ID = 5819848586;

export const GCR_OPTIN_SCRIPT_SRC = 'https://apis.google.com/js/platform.js';
export const GCR_BADGE_SCRIPT_SRC = 'https://www.gstatic.com/shopping/merchant/merchantwidget.js';

// What the confirmation page promises ("Est. Delivery 3 - 5 Business Days").
// Google emails the survey shortly after this date, so it errs to the late end
// — a survey that lands before the parcel invites a "never arrived" review.
export const GCR_DELIVERY_BUSINESS_DAYS = 5;

// Australian English for the opt-in dialog, rather than whatever the visitor's
// browser reports (Google's "GCR Language Code", window.___gcfg).
export const GCR_LANGUAGE = 'en-AU';

// Google's default, stated explicitly: a centred dialog. The confirmation page
// has nothing time-critical under it, and the corner styles would collide with
// sonner toasts (bottom-right) and the badge corner (bottom-left).
export const GCR_OPT_IN_STYLE = 'CENTER_DIALOG';

// ISO 3166-1 alpha-2, and never "ZZ" (Google rejects it). Anything else falls
// back to AU — checkout is Australia-only (checkAustralianAddress).
export const normaliseDeliveryCountry = (country) => {
  const code = String(country || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== 'ZZ' ? code : 'AU';
};

// GTIN-8 / UPC-A / EAN-13 / GTIN-14, digits only — the shapes Google accepts.
const isGtin = (g) => /^([0-9]{8}|[0-9]{12,14})$/.test(String(g || '').trim());

// The optional `products` array: lets Google collect product reviews, not just
// the seller review. Only valid GTINs go in; none → the field is left out.
export const surveyProducts = (gtins) => {
  const unique = [...new Set((Array.isArray(gtins) ? gtins : []).map((g) => String(g || '').trim()).filter(isGtin))];
  return unique.map((gtin) => ({ gtin }));
};

// Google wants name@domain.com — don't hand it something it will reject.
const looksLikeEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

// Off a real deployment (vite dev, local preview, e2e) nothing loads — mirrors
// main.jsx's analyticsEnabled gate.
const gcrEnabled = () => {
  if (!import.meta.env.PROD || typeof window === 'undefined') return false;
  return !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)$/.test(window.location.hostname);
};

// Adds `businessDays` weekdays to `from` and returns YYYY-MM-DD (local date —
// Google wants the buyer-facing calendar day, not a UTC timestamp).
export const estimatedDeliveryDate = (from = new Date(), businessDays = GCR_DELIVERY_BUSINESS_DAYS) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const loadScript = (src, attrs = {}) => {
  const script = document.createElement('script');
  script.async = true;
  Object.entries(attrs).forEach(([k, v]) => script.setAttribute(k, v));
  script.src = src;
  document.head.appendChild(script);
  return script;
};

// ─── Survey opt-in ──────────────────────────────────────────────────────────

// Order ids already offered this page-life, so a re-render (StrictMode, a
// returning effect) never stacks a second opt-in dialog for the same order.
const offeredOrders = new Set();

/**
 * Shows Google's survey opt-in for a completed order. Safe to call more than
 * once — the same order is only offered once per page load.
 *
 * @param {object} order
 * @param {string} order.orderId   unique order id (the Stripe Checkout Session id)
 * @param {string} order.email     buyer's email
 * @param {string} [order.deliveryCountry]  ISO-3166 alpha-2, defaults to AU
 * @param {string} [order.estimatedDeliveryDate]  YYYY-MM-DD
 * @param {string[]} [order.gtins]  barcodes of the shop products bought
 * @returns {boolean} whether the opt-in was requested
 */
export const renderSurveyOptIn = ({ orderId, email, deliveryCountry, estimatedDeliveryDate: eta, gtins } = {}) => {
  if (!gcrEnabled() || !orderId || !looksLikeEmail(email) || offeredOrders.has(orderId)) return false;
  offeredOrders.add(orderId);

  const options = {
    merchant_id: GCR_MERCHANT_ID,
    order_id: String(orderId),
    email: String(email).trim(),
    delivery_country: normaliseDeliveryCountry(deliveryCountry),
    estimated_delivery_date: eta || estimatedDeliveryDate(),
    opt_in_style: GCR_OPT_IN_STYLE,
  };
  const products = surveyProducts(gtins);
  if (products.length > 0) options.products = products;

  const render = () => {
    try {
      window.gapi.load('surveyoptin', () => {
        window.gapi.surveyoptin.render(options);
      });
    } catch { /* reviews are non-critical */ }
  };

  try {
    // platform.js already on the page (a second purchase in the same session):
    // its onload hook won't fire again, so render directly.
    if (window.gapi?.load) {
      render();
    } else {
      window.renderOptIn = render;
      // Must be set before platform.js loads — it reads the config once.
      window.___gcfg = { ...(window.___gcfg || {}), lang: GCR_LANGUAGE };
      if (!document.querySelector(`script[src^="${GCR_OPTIN_SCRIPT_SRC}"]`)) {
        loadScript(`${GCR_OPTIN_SCRIPT_SRC}?onload=renderOptIn`, { defer: '' });
      }
    }
  } catch {
    return false;
  }
  return true;
};

// ─── Badge ──────────────────────────────────────────────────────────────────

// Screens where the floating badge would sit on top of a task: checkout (the
// opt-in dialog owns the confirmation page), sign-in, and the account/admin
// tools. Once loaded the badge stays for the rest of the visit — the widget has
// no stop API — but it is never *started* from one of these.
const NO_BADGE_PREFIXES = [
  '/checkout', '/checkout-success', '/success',
  '/login', '/logout', '/signup', '/forgot-password', '/reset-password',
  '/admin', '/launch',
];

export const isBadgeEligiblePath = (pathname = '/') => {
  const path = String(pathname).toLowerCase().replace(/\/+$/, '') || '/';
  return !NO_BADGE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

let badgeScheduled = false;

// Loads the badge off the critical path on the first eligible page of a visit:
// on the visitor's first interaction, or a few seconds after `load` for
// visitors who never interact (lib/deferredLoad.js). It used to load at idle
// (5 s cap), which still put the widget — its loader script, the badge iframe,
// that iframe's own scripts and its Google-hosted web font — inside the window
// PageSpeed Insights measures, where it showed up as third-party "unused" and
// "legacy" JavaScript, short-lived cache entries and a font-display warning.
// A seller-rating badge nobody has looked at yet loses nothing by waiting.
// Called on every route change by GoogleReviewsBadgeLoader.
export const scheduleBadgeLoad = (pathname) => {
  if (badgeScheduled || !gcrEnabled() || !isBadgeEligiblePath(pathname)) return;
  badgeScheduled = true;

  const load = () => {
    try {
      const script = loadScript(GCR_BADGE_SCRIPT_SRC, { id: 'merchantWidgetScript' });
      script.addEventListener('load', () => {
        try {
          window.merchantwidget.start({
            merchant_id: GCR_MERCHANT_ID,
            // Bottom-left: sonner toasts own the bottom-right corner (App.jsx).
            position: 'LEFT_BOTTOM',
            region: 'AU',
          });
        } catch { /* reviews are non-critical */ }
      }, { once: true });
    } catch { /* reviews are non-critical */ }
  };

  onFirstInteractionOrLoad(load);
};
