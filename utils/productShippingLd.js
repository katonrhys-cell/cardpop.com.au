// schema.org shipping terms for a product's Offer — the `shippingDetails`
// Google's Merchant listings report asks for ("Missing field shippingDetails").
//
// Shop: flat rate per order, free from the threshold, the two numbers an admin
// edits in Admin → Settings (platform_settings `default_shipping_rate_aud` /
// `free_shipping_threshold_aud`, priced at checkout by src/services/cartService.js).
// A single unit at or above the threshold ships free; below it pays the flat
// rate — exactly what a shopper buying just that product is charged.
//
// Marketplace: the seller's own per-listing postage (`listings.shipping_cost_aud`),
// posted within the Buyer Protection window (utils/buyerProtectionPolicy.js).
//
// The delivery times are the ones the Shipping page (pages/info/ShippingPage.jsx)
// promises — that page reads them from here, so the markup and the page can't
// drift. Dependency-free (bar the policy module) so the SPA and
// api/prerender.js can both import it.

import { MARKETPLACE_PROTECTION } from './buyerProtectionPolicy.js';

// The checkout's fallbacks when the settings rows are missing — keep in step
// with cartService.js and src/routes/settings.js.
export const SHOP_SHIPPING_DEFAULTS = Object.freeze({ rateAud: 15, freeThresholdAud: 100 });

export const SHOP_DELIVERY_TIMES = Object.freeze({
  dispatchBusinessDays: 2,
  transitMinBusinessDays: 3,
  transitMaxBusinessDays: 7,
});

const BUSINESS_DAYS = Object.freeze({
  '@type': 'OpeningHoursSpecification',
  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => `https://schema.org/${d}`),
});

const dayRange = (minValue, maxValue) => ({ '@type': 'QuantitativeValue', minValue, maxValue, unitCode: 'DAY' });
const money = (value) => Math.round(Math.max(0, Number(value) || 0) * 100) / 100;

function offerShippingDetails({ rateAud, handling, transit, businessDays }) {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: money(rateAud), currency: 'AUD' },
    // Checkout is Australia-only (src/utils/addressValidation.js).
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'AU' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      ...(businessDays ? { businessDays: BUSINESS_DAYS } : {}),
      handlingTime: dayRange(...handling),
      transitTime: dayRange(...transit),
    },
  };
}

// Normalise the public settings shape (`/settings/public`, the
// shop_shipping_terms() RPC, PlatformSettingsContext) into the rate/threshold
// pair, falling back per field to the checkout defaults.
export function shopShippingTerms(settings) {
  const num = (v, fallback) => {
    const n = Number(v);
    return v !== null && v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    rateAud: num(settings?.default_shipping_rate_aud, SHOP_SHIPPING_DEFAULTS.rateAud),
    freeThresholdAud: num(settings?.free_shipping_threshold_aud, SHOP_SHIPPING_DEFAULTS.freeThresholdAud),
  };
}

// What one unit at `priceAud` pays for shipping on its own.
export function shopShippingRateAud(priceAud, terms = SHOP_SHIPPING_DEFAULTS) {
  const { rateAud, freeThresholdAud } = { ...SHOP_SHIPPING_DEFAULTS, ...terms };
  return Number(priceAud) >= freeThresholdAud ? 0 : rateAud;
}

export function shopShippingDetailsLd(priceAud, terms = SHOP_SHIPPING_DEFAULTS) {
  return offerShippingDetails({
    rateAud: shopShippingRateAud(priceAud, terms),
    handling: [0, SHOP_DELIVERY_TIMES.dispatchBusinessDays],
    transit: [SHOP_DELIVERY_TIMES.transitMinBusinessDays, SHOP_DELIVERY_TIMES.transitMaxBusinessDays],
    businessDays: true,
  });
}

// Marketplace sellers post within the Buyer Protection window (calendar days);
// transit is the same Australia Post estimate the Shipping page gives.
export function marketplaceShippingDetailsLd(shippingCostAud) {
  return offerShippingDetails({
    rateAud: shippingCostAud,
    handling: [0, MARKETPLACE_PROTECTION.notShippedClaimAfterDays],
    transit: [SHOP_DELIVERY_TIMES.transitMinBusinessDays, SHOP_DELIVERY_TIMES.transitMaxBusinessDays],
    businessDays: false,
  });
}
