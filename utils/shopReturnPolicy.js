// The CardPop Shop return policy — the one registered in Google Merchant
// Center (Merchant Center → Returns). Google reviews the /returns page and the
// product structured data against those settings, so every place that states
// the shop policy reads it from here. Change it here AND in Merchant Center
// together, or the listings get flagged for a mismatch.
//
// Dependency-free so the SPA and api/prerender.js can both import it.
//
// Merchant Center settings this mirrors:
//   Countries: Australia
//   Returns: defective and non-defective (change of mind) products
//   Exchanges: accepted
//   Product condition: new only
//   Window: 14 days (was 5 until 2026-10-03 — update Merchant Center to match)
//   Method: by mail; return label: customer responsibility
//   Restocking fee: none
//   Refund processing time: 7 days
//
// Marketplace cards have their own, different rules (binding sale, no change
// of mind, full refund when the seller is at fault) — utils/buyerProtectionPolicy.js.
export const SHOP_RETURN_POLICY = Object.freeze({
  country: 'AU',
  windowDays: 14,
  refundProcessingDays: 7,
  acceptsChangeOfMind: true,
  acceptsExchanges: true,
  restockingFee: 0,
});

// schema.org MerchantReturnPolicy for a shop product's Offer.
export const shopMerchantReturnPolicyLd = () => ({
  '@type': 'MerchantReturnPolicy',
  applicableCountry: SHOP_RETURN_POLICY.country,
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: SHOP_RETURN_POLICY.windowDays,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
  itemCondition: 'https://schema.org/NewCondition',
  merchantReturnLink: 'https://cardpop.com.au/returns',
});
