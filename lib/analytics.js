// Google Analytics 4 (gtag.js) helpers — page views, GA4 ecommerce events and
// the optional Google Ads conversion tag.
//
// The gtag <script> itself is injected lazily — on first user interaction, see
// loadThirdPartyScripts in main.jsx — so it never competes with React
// hydration for the main thread. The command queue (window.dataLayer) is
// created here instead, synchronously at boot: gtag.js replays the queue in
// order when it finally loads, so the landing page and any routes the visitor
// touches *before* the script lands are still recorded correctly.

import { hasMarketingConsent, onConsentChange } from '@/lib/consent.js';

export const GA_MEASUREMENT_ID = 'G-NCZ6K9VFF8';

// Google Ads conversion tracking is dormant until the ids are set in Vercel
// (build-time). GOOGLE_ADS_ID is the "AW-…" tag id; the purchase label is the
// conversion-action label Google shows under "Tag setup" (e.g. "AbCdEfGhIj").
export const GOOGLE_ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID || '';
export const GOOGLE_ADS_PURCHASE_LABEL = import.meta.env.VITE_GOOGLE_ADS_PURCHASE_LABEL || '';

export const CURRENCY = 'AUD';

let adsConfigured = false;

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
 *
 * Consent Mode v2: analytics storage is granted (first-party measurement);
 * ad storage / ad user data / ad personalisation start denied and flip to
 * granted only once the visitor accepts marketing cookies. Google Ads
 * conversions are modelled rather than recorded until then.
 */
export function installGtag() {
  if (typeof window === 'undefined' || typeof window.gtag === 'function') return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  const marketing = hasMarketingConsent();
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
  });
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
  if (marketing) configureGoogleAds();
  onConsentChange((value) => {
    const granted = value === 'all' ? 'granted' : 'denied';
    gtag('consent', 'update', { ad_storage: granted, ad_user_data: granted, ad_personalization: granted });
    if (value === 'all') configureGoogleAds();
  });
}

function configureGoogleAds() {
  if (adsConfigured || !GOOGLE_ADS_ID || typeof window.gtag !== 'function') return;
  adsConfigured = true;
  window.gtag('config', GOOGLE_ADS_ID, { allow_enhanced_conversions: true });
}

const gtagReady = () => typeof window !== 'undefined' && typeof window.gtag === 'function';

/**
 * Record a GA4 page_view for the given path ("/pathname?query"). No-op when
 * the gtag stub was never installed (dev, localhost, e2e).
 */
export function trackPageView(path) {
  if (!gtagReady()) return;
  window.gtag('event', 'page_view', {
    page_location: window.location.origin + path,
    page_path: path,
    page_title: typeof document !== 'undefined' ? document.title : undefined,
  });
}

/** Generic GA4 event. No-op outside production. */
export function trackEvent(name, params = {}) {
  if (!gtagReady() || !name) return;
  window.gtag('event', name, params);
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Normalise a product/listing/cart line into a GA4 ecommerce `item`.
 * Accepts the loose shapes used across the app (PDP product, shop row, cart
 * entry) so call sites don't each need to know the GA schema.
 */
export function toGaItem(input = {}, quantity = 1) {
  const p = input.product || input;
  const variant = input.variant || null;
  const price = variant?.sale_price_in_cents != null
    ? variant.sale_price_in_cents / 100
    : variant?.price_in_cents != null
      ? variant.price_in_cents / 100
      : Number(p.price ?? p.price_aud ?? 0);
  const item = {
    item_id: String(p.id ?? p.sku ?? ''),
    item_name: String(p.name ?? p.title ?? p.card_name ?? 'Item'),
    price: round2(price),
    quantity: Math.max(1, Number(input.quantity ?? quantity) || 1),
    item_category: p.type === 'shop' || p.source === 'shop' ? 'Shop' : 'Marketplace',
  };
  if (p.category) item.item_category2 = String(p.category);
  if (p.sku) item.item_variant = String(p.sku);
  if (variant?.title || variant?.name) item.item_variant = String(variant.title || variant.name);
  if (p.seller_id || p.sellerId) item.affiliation = String(p.seller_id || p.sellerId);
  return item;
}

const sumItems = (items) => round2(items.reduce((t, i) => t + (i.price || 0) * (i.quantity || 1), 0));

/** Product page viewed. */
export function trackViewItem(product) {
  if (!product) return;
  const items = [toGaItem(product)];
  trackEvent('view_item', { currency: CURRENCY, value: sumItems(items), items });
  metaTrack('ViewContent', metaContent(items));
}

/** Item(s) added to the cart. */
export function trackAddToCart(product, variant, quantity = 1) {
  if (!product) return;
  const items = [toGaItem({ product, variant, quantity })];
  trackEvent('add_to_cart', { currency: CURRENCY, value: sumItems(items), items });
  metaTrack('AddToCart', metaContent(items));
}

/** Checkout page opened with items in the cart. */
export function trackBeginCheckout(cartEntries = []) {
  const items = cartEntries.map((e) => toGaItem(e));
  if (!items.length) return;
  trackEvent('begin_checkout', { currency: CURRENCY, value: sumItems(items), items });
  metaTrack('InitiateCheckout', { ...metaContent(items), num_items: items.length });
}

/** Buyer submitted shipping/billing and reached the payment form. */
export function trackAddPaymentInfo(cartEntries = []) {
  const items = cartEntries.map((e) => toGaItem(e));
  if (!items.length) return;
  trackEvent('add_payment_info', { currency: CURRENCY, value: sumItems(items), items });
  metaTrack('AddPaymentInfo', metaContent(items));
}

const PURCHASE_SENT_KEY = 'cardpop_ga_purchase_sent';

/**
 * Order paid. Deduplicated per Stripe session id (the confirmation page can be
 * reloaded, bookmarked or opened twice) so GA, Google Ads and Meta each count
 * a sale once.
 */
export function trackPurchase({ transactionId, value, shipping = 0, tax = 0, items = [], coupon } = {}) {
  if (!transactionId) return false;
  try {
    const sent = JSON.parse(window.sessionStorage.getItem(PURCHASE_SENT_KEY) || '[]');
    if (sent.includes(transactionId)) return false;
    window.sessionStorage.setItem(PURCHASE_SENT_KEY, JSON.stringify([...sent, transactionId].slice(-20)));
  } catch { /* storage unavailable — still fire once for this page load */ }
  const gaItems = items.map((i) => toGaItem(i));
  const total = round2(value);
  trackEvent('purchase', {
    transaction_id: transactionId,
    currency: CURRENCY,
    value: total,
    shipping: round2(shipping),
    tax: round2(tax),
    ...(coupon ? { coupon } : {}),
    items: gaItems,
  });
  if (GOOGLE_ADS_ID && GOOGLE_ADS_PURCHASE_LABEL && hasMarketingConsent()) {
    trackEvent('conversion', {
      send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_PURCHASE_LABEL}`,
      value: total,
      currency: CURRENCY,
      transaction_id: transactionId,
    });
  }
  metaTrack('Purchase', { ...metaContent(gaItems), value: total, currency: CURRENCY }, { eventID: transactionId });
  return true;
}

// ---- Meta Pixel bridge ------------------------------------------------------
// lib/metaPixel.js owns loading fbevents.js (consent-gated). It registers a
// sender here so analytics call sites don't import it directly.
let metaSender = null;
export function registerMetaSender(fn) { metaSender = typeof fn === 'function' ? fn : null; }
function metaTrack(event, params, options) {
  if (!metaSender) return;
  try { metaSender(event, params, options); } catch { /* pixel is non-critical */ }
}
function metaContent(items) {
  return {
    content_type: 'product',
    content_ids: items.map((i) => i.item_id),
    contents: items.map((i) => ({ id: i.item_id, quantity: i.quantity, item_price: i.price })),
    value: sumItems(items),
    currency: CURRENCY,
  };
}
