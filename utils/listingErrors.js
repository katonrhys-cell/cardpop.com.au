// Marketplace listings are written by direct client-side inserts, so the
// `can_sell()` entitlement (Stripe Identity verification + card on file) is
// enforced by the RESTRICTIVE RLS policy `listings_require_selling_entitlement`
// on the `listings` table. When that policy denies a write, Postgres reports a
// generic insufficient-privilege error (42501) — this helper recognises it so
// the UI can explain the two missing prerequisites instead of surfacing a raw
// "row violates row-level security" message (or, worse, nothing at all).
export const isSellingEntitlementError = (error) => {
  if (!error) return false;
  if (error.code === '42501') return true;
  return /row-level security/i.test(error.message || '');
};
