// Canonical shape of a CardPop seller's Stripe v2 account — the single source of
// truth shared by the on-demand onboarding flow (src/services/connectService.js)
// and the bulk backfill (scripts/backfill-seller-connect-accounts.mjs) so they
// can never drift. Pure functions only, no imports/side effects, so the ops
// script can import them without pulling in the DB/Stripe clients.
//
// Sellers are v2 unified Accounts with a `recipient` configuration whose
// `stripe_transfers` capability lets the platform push proceeds to them via
// `stripe.transfers.create({ destination })`. The platform collects losses/fees.

// The configuration(s) we onboard sellers into. Recipient-only for now (they
// receive payouts); add 'merchant'/'customer' here — and the matching block in
// buildSellerAccountParams — if the platform later moves to direct/destination
// charges or a unified buyer identity.
export const SELLER_CONFIGURATIONS = ['recipient'];

// Build the `stripe.v2.core.accounts.create` payload for a seller: AU identity,
// stripe_transfers capability requested, platform as losses + fees collector,
// Express dashboard.
export function buildSellerAccountParams(userId, { email, displayName } = {}) {
  return {
    ...(displayName ? { display_name: displayName } : {}),
    ...(email ? { contact_email: email } : {}),
    identity: { country: 'au' },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    defaults: {
      responsibilities: {
        losses_collector: 'application',
        fees_collector: 'application',
      },
    },
    dashboard: 'express',
    include: ['configuration.recipient', 'identity', 'requirements'],
    metadata: { cardpop_user_id: userId },
  };
}

// Whether a retrieved v2 account has finished onboarding enough to be paid:
// its recipient stripe_transfers capability is active. Read defensively.
export function isPayoutReady(account) {
  const status = account?.configuration?.recipient
    ?.capabilities?.stripe_balance?.stripe_transfers?.status;
  return status === 'active';
}
