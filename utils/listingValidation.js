// Validation rules for the Add/Edit Card listing form, extracted so they can
// run two ways: the whole form on submit, and a single field on blur (inline
// feedback instead of submit-only surprises). Everything the submit used to
// gate separately — the card image and the Category/Franchise hierarchy —
// lives here too, so one pass surfaces every problem at once instead of the
// old toast-then-discover-more two-step.
//
// ctx: { isEdit, lockedBaseValue, selCategoryId, franchiseId, hasImage, requireImage }

const SALE_TYPES = ['For Sale', 'For Sale & Trade'];

const FIELD_VALIDATORS = {
  cardName: (f) => (!f.cardName?.trim() ? 'Card name is required' : null),

  estimatedValue: (f, ctx) => {
    if (!f.estimatedValue || parseFloat(f.estimatedValue) < 0) return 'Enter a valid estimated value';
    if (ctx.isEdit && ctx.lockedBaseValue != null && (parseFloat(f.estimatedValue) || 0) < ctx.lockedBaseValue)
      return `Cannot be set below the locked base value of $${ctx.lockedBaseValue.toFixed(2)}`;
    return null;
  },

  year: (f) => {
    const yearVal = f.year?.trim();
    if (!yearVal) return null;
    const match = yearVal.match(/^(\d{4})(?:\/(\d{4}))?$/);
    if (!match) return 'Enter a single year (e.g. 2025) or a range (e.g. 2025/2026)';
    const maxYear = new Date().getFullYear() + 1;
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : null;
    if (start < 1900 || start > maxYear) return `Year must be between 1900 and ${maxYear}`;
    if (end !== null && end !== start + 1) return 'A season range must be two consecutive years (e.g. 2025/2026)';
    return null;
  },

  askingPrice: (f) => {
    if (!SALE_TYPES.includes(f.listingType)) return null;
    const ap = parseFloat(f.askingPrice);
    return !ap || ap <= 0 ? 'Enter a valid asking price' : null;
  },

  offerMin: (f) => {
    if (f.listingType !== 'Expression of Interest') return null;
    const min = parseFloat(f.offerMin);
    return !min || min <= 0 ? 'Enter the minimum of the price range you want offers in' : null;
  },

  offerMax: (f) => {
    if (f.listingType !== 'Expression of Interest') return null;
    const min = parseFloat(f.offerMin);
    const max = parseFloat(f.offerMax);
    if (!max || max <= 0) return 'Enter the maximum of the price range you want offers in';
    if (min > 0 && max < min) return 'Must be at least the minimum of the range';
    return null;
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
