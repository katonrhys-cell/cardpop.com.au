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
export const GCR_MERCHANT_ID = 5819848586;

export const GCR_OPTIN_SCRIPT_SRC = 'https://apis.google.com/js/platform.js';
export const GCR_BADGE_SCRIPT_SRC = 'https://www.gstatic.com/shopping/merchant/merchantwidget.js';

// What the confirmation page promises ("Est. Delivery 3 - 5 Business Days").
// Google emails the survey shortly after this date, so it errs to the late end
// — a survey that lands before the parcel invites a "never arrived" review.
export const GCR_DELIVERY_BUSINESS_DAYS = 5;

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
 * @returns {boolean} whether the opt-in was requested
 */
export const renderSurveyOptIn = ({ orderId, email, deliveryCountry, estimatedDeliveryDate: eta } = {}) => {
  if (!gcrEnabled() || !orderId || !email || offeredOrders.has(orderId)) return false;
  offeredOrders.add(orderId);

  const options = {
    merchant_id: GCR_MERCHANT_ID,
    order_id: String(orderId),
    email: String(email),
    // Checkout is Australia-only (checkAustralianAddress), so AU is the
    // correct fallback when Stripe didn't return a shipping country.
    delivery_country: (deliveryCountry || 'AU').toUpperCase(),
    estimated_delivery_date: eta || estimatedDeliveryDate(),
  };

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

// Loads the badge off the critical path (idle, 5s cap) on the first eligible
// page of a visit. Called on every route change by GoogleReviewsBadgeLoader.
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

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(load, { timeout: 5000 });
  } else {
    window.setTimeout(load, 1500);
  }
};
