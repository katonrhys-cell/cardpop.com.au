// Validation rules for the Add/Edit Card listing form, extracted so they can
// run two ways: the whole form on submit, and a single field on blur (inline
// feedback instead of submit-only surprises). Everything the submit used to
// gate separately — the card image and the Category/Franchise hierarchy —
// lives here too, so one pass surfaces every problem at once instead of the
// old toast-then-discover-more two-step.
//
// ctx: { isEdit, lockedBaseValue, selCategoryId, franchiseId, hasImage, requireImage }

import { validateOfferWindowDates } from './offerWindowDates.js';

const SALE_TYPES = ['For Sale', 'For Sale & Trade'];

const FIELD_VALIDATORS = {
  cardName: (f) => (!f.cardName?.trim() ? 'Card name is required' : null),

  estimatedValue: (f, ctx) => {
    if (!f.estimatedValue || parseFloat(f.estimatedValue) < 0) return 'Enter a valid estimated value';
    if (ctx.isEdit && ctx.lockedBaseValue != null && (parseFloat(f.estimatedValue) || 0) < ctx.lockedBaseValue)
      return `Cannot be set below the locked base value of $${ctx.lockedBaseValue.toFixed(2)}`;
    return null;
  },

  // Seasons are printed on cards several ways — 2025/2026, 2025-2026 and the
  // shorthand 2025-26 all mean the same season, and the hyphen forms are what
  // both card fronts and the identification pipeline actually produce. Accept
  // all of them rather than rejecting a correctly-read year.
  year: (f) => {
    const yearVal = f.year?.trim();
    if (!yearVal) return null;
    const match = yearVal.match(/^(\d{4})(?:\s*[/–—-]\s*(\d{2}|\d{4}))?$/);
    if (!match) return 'Enter a single year (e.g. 2025) or a season (e.g. 2025-26)';
    const maxYear = new Date().getFullYear() + 1;
    const start = parseInt(match[1], 10);
    if (start < 1900 || start > maxYear) return `Year must be between 1900 and ${maxYear}`;
    if (match[2]) {
      const rawEnd = match[2];
      let end = parseInt(rawEnd, 10);
      if (rawEnd.length === 2) {
        // Expand "26" against the start year's century, rolling over for
        // seasons that cross one (1999-00 → 2000).
        end += Math.floor(start / 100) * 100;
        if (end < start) end += 100;
      }
      if (end !== start + 1) return 'A season must be two consecutive years (e.g. 2025-26)';
    }
    return null;
  },

  askingPrice: (f) => {
    if (!SALE_TYPES.includes(f.listingType)) return null;
    const ap = parseFloat(f.askingPrice);
    return !ap || ap <= 0 ? 'Enter a valid asking price' : null;
  },

  // Postage the buyer pays at checkout, passed through to the seller. Blank or
  // 0 means the seller ships free. The $200 ceiling matches the DB check
  // constraint — well above any real AU postage cost, low enough that a typo
  // can't turn the postage line into a second asking price.
  shippingCost: (f) => {
    if (!SALE_TYPES.includes(f.listingType) && f.listingType !== 'Expression of Interest') return null;
    if (!f.shippingCost || !String(f.shippingCost).trim()) return null;
    const sc = parseFloat(f.shippingCost);
    if (!Number.isFinite(sc) || sc < 0) return 'Enter a valid shipping cost (or leave blank for free shipping)';
    if (sc > 200) return 'Shipping cannot be more than $200';
    return null;
  },

  offerMin: (f) => {
    if (f.listingType !== 'Expression of Interest') return null;
    const min = parseFloat(f.offerMin);
    return !min || min <= 0 ? 'Enter the minimum offer you want to receive' : null;
  },

  // The top of an EOI range is optional — blank means "offers from $X" with
  // no ceiling.
  offerMax: (f) => {
    if (f.listingType !== 'Expression of Interest') return null;
    if (f.offerMax == null || !String(f.offerMax).trim()) return null;
    const min = parseFloat(f.offerMin);
    const max = parseFloat(f.offerMax);
    if (!Number.isFinite(max) || max <= 0) return 'Enter a valid maximum, or leave it blank for no upper limit';
    if (min > 0 && max < min) return 'Must be at least the minimum of the range';
    return null;
  },

  // Optional offer window (dates the EOI takes offers between).
  offerOpenDate: (f) => {
    if (f.listingType !== 'Expression of Interest') return null;
    return validateOfferWindowDates(f.offerOpenDate, f.offerCloseDate).offerOpenDate ?? null;
  },

  offerCloseDate: (f) => {
    if (f.listingType !== 'Expression of Interest') return null;
    return validateOfferWindowDates(f.offerOpenDate, f.offerCloseDate).offerCloseDate ?? null;
  },

  tradeValue: (f, ctx) => {
    if (!ctx.isEdit || ctx.lockedBaseValue == null) return null;
    const tv = parseFloat(f.tradeValue) || 0;
    return tv > 0 && tv < ctx.lockedBaseValue
      ? `Trade value cannot be set below the locked base value of $${ctx.lockedBaseValue.toFixed(2)}`
      : null;
  },

  // Both Category and Franchise are needed: the franchise places the card in
  // its collection page — a broad category alone leaves it out of every one.
  hierarchy: (f, ctx) =>
    !ctx.selCategoryId || !ctx.franchiseId
      ? 'Choose both a Category and a Franchise (e.g. Sports → NBA) so your card appears in the right collection'
      : null,

  cardImage: (f, ctx) => (ctx.requireImage && !ctx.hasImage ? 'Add a photo of your card' : null),
};

export const validateListingField = (field, formData, ctx = {}) =>
  FIELD_VALIDATORS[field] ? FIELD_VALIDATORS[field](formData ?? {}, ctx) : null;

export const validateListingForm = (formData, ctx = {}) => {
  const errors = {};
  for (const field of Object.keys(FIELD_VALIDATORS)) {
    const message = validateListingField(field, formData, ctx);
    if (message) errors[field] = message;
  }
  return errors;
};
