// Marketplace listings are written by direct client-side inserts, so two
// database-layer gates can reject a write and the UI needs to recognise each
// one to explain it properly:
//
//   1. The `can_sell()` entitlement (Stripe Identity verification + card on
//      file), enforced by the RESTRICTIVE RLS policy
//      `listings_require_selling_entitlement`. Postgres reports a generic
//      insufficient-privilege error (42501).
//   2. The monthly listing quota (`enforce_monthly_listing_quota` BEFORE
//      INSERT trigger), which raises with a LISTING_QUOTA_EXCEEDED marker in
//      the message so it can be told apart from any other raise.
//
// These helpers recognise both so the UI can explain what's actually missing
// instead of surfacing a raw "row violates row-level security" (or worse,
// nothing at all).

export const isSellingEntitlementError = (error) => {
  if (!error) return false;
  if (error.code === '42501') return true;
  return /row-level security/i.test(error.message || '');
};

// The seller has hit their tier's monthly listing allowance. The trigger's
// message carries the tier's numbers; the UI pairs this with the limits in
// config/plans.js to pitch the upgrade.
export const isListingQuotaError = (error) => {
  if (!error) return false;
  return /LISTING_QUOTA_EXCEEDED/i.test(error.message || '');
};
