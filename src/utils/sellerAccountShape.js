// Canonical shape of a CardPop seller's Stripe Connect Express account — the
// single source of truth shared by the on-demand onboarding flow
// (src/services/connectService.js) and the bulk backfill
// (scripts/backfill-seller-connect-accounts.mjs) so they can never drift.
// Pure functions only, no imports/side effects, so the ops script can import
// them without pulling in the DB/Stripe clients.
//
// Sellers are classic v1 Express accounts with only the `transfers` capability
// requested: they receive their sale proceeds via
// `stripe.transfers.create({ destination })` — the platform charges the buyer
// and keeps its commission before the transfer. (The earlier iteration of this
// module targeted the v2 Accounts API, but that API must be explicitly enabled
// per platform account and wasn't on the live account — Express accounts work
// on any platform with Connect activated, and the transfer money-flow is
// identical.)

// Build the `stripe.accounts.create` payload for a seller: AU Express account,
// transfers capability requested, seller's display name as the trading name.
export function buildSellerAccountParams(userId, { email, displayName } = {}) {
  return {
    type: 'express',
    country: 'AU',
    ...(email ? { email } : {}),
    capabilities: {
      transfers: { requested: true },
    },
    ...(displayName ? { business_profile: { name: displayName } } : {}),
    metadata: { cardpop_user_id: userId },
  };
}

// Whether a retrieved account has finished onboarding enough to be paid:
// payouts are enabled and the transfers capability is active. Read defensively.
export function isPayoutReady(account) {
  return Boolean(account?.payouts_enabled && account?.capabilities?.transfers === 'active');
}

// The KYC'd legal name on a retrieved account. Individuals carry
// first/last name; companies (incl. sole traders registered as a business)
// carry a legal company name. Empty string when Stripe holds neither yet.
export function payoutAccountName(account) {
  const individual = account?.individual;
  const personal = [individual?.first_name, individual?.last_name].filter(Boolean).join(' ').trim();
  return personal || account?.company?.name || '';
}
