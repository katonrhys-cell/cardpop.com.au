// Canonical shape of a CardPop seller's Stripe Connect account — the single
// source of truth shared by the on-demand onboarding flow
// (src/services/connectService.js) and the bulk backfill
// (scripts/backfill-seller-connect-accounts.mjs) so they can never drift.
// No imports and no side effects, so the ops script can pull these in without
// dragging in the DB/Stripe clients.
//
// ─── Account configuration ───────────────────────────────────────────────────
//
// New seller accounts are created with explicit **controller properties**
// rather than the legacy `type: 'express'` shorthand:
//
//   controller.fees.payer            = 'account'  → Stripe-managed pricing
//   controller.losses.payments       = 'stripe'   → Managed Risk (Stripe eats
//                                                   unrecoverable negative
//                                                   balances, not CardPop)
//   controller.stripe_dashboard.type = 'express'  → Express Dashboard, same as
//                                                   before
//   controller.requirement_collection = 'stripe'  → Stripe-hosted onboarding,
//                                                   so Account Links and
//                                                   `accounts.createLoginLink`
//                                                   keep working unchanged
//
// The only behavioural difference that matters to CardPop is loss liability.
// `type: 'express'` implies `losses.payments = 'application'`: when a seller's
// connected account goes negative — typically because a buyer charged back
// after the seller's payout had already left Stripe, so the transfer reversal
// pushes them below zero — and the balance can't be recovered, **the platform
// is debited**. Under Managed Risk, Stripe carries that loss instead.
//
// What this does NOT change: CardPop uses separate charges and transfers (the
// buyer is charged on the *platform* account, then proceeds are pushed out with
// `transfers.create({ destination })`). Card processing fees are therefore
// still paid by the platform, and the platform is still the merchant of record
// on the buyer's payment — `fees.payer: 'account'` only governs fees for
// activity on the seller's own account (i.e. their payouts). Commission maths
// in src/routes/stripe.js is untouched.
//
// ─── Existing sellers ────────────────────────────────────────────────────────
//
// Controller properties are fixed at creation: an account created as Express
// cannot be converted to Managed Risk later. Sellers onboarded before this
// change stay platform-liable for the life of that account, so both shapes are
// kept here and `sellerLossLiability()` reports which one a retrieved account
// is on.
//
// (An earlier iteration of this module targeted the v2 Accounts API, which had
// to be enabled per platform and wasn't on the live account — hence the
// fallback in `createSellerConnectAccount` below, which keeps seller onboarding
// working even if the platform isn't enabled for this configuration yet.)

const SHARED_CAPABILITIES = {
  // card_payments is requested alongside transfers even though CardPop's money
  // flow never has the seller charge cards directly: Stripe rejects
  // transfers-WITHOUT-card_payments account creation unless the platform has
  // been specifically approved for it ("Your platform needs approval for
  // accounts to have requested the `transfers` capability without the
  // `card_payments` capability"). The standard pairing needs no approval; the
  // unused capability is harmless.
  card_payments: { requested: true },
  transfers: { requested: true },
};

function commonParams(userId, { email, displayName } = {}, config) {
  return {
    country: 'AU',
    ...(email ? { email } : {}),
    capabilities: { ...SHARED_CAPABILITIES },
    ...(displayName ? { business_profile: { name: displayName } } : {}),
    // cardpop_account_config records which shape the account was created with,
    // so an account's liability model is visible in the Stripe dashboard
    // without cross-referencing its creation date.
    metadata: { cardpop_user_id: userId, cardpop_account_config: config },
  };
}

// Build the `stripe.accounts.create` payload for a new seller: AU account with
// Stripe-managed pricing, Managed Risk and the Express Dashboard.
// `type` is deliberately absent — Stripe rejects `type` and `controller`
// together.
export function buildSellerAccountParams(userId, opts = {}) {
  return {
    ...commonParams(userId, opts, 'managed_risk'),
    controller: {
      fees: { payer: 'account' },
      losses: { payments: 'stripe' },
      requirement_collection: 'stripe',
      stripe_dashboard: { type: 'express' },
    },
  };
}

// The pre-Managed-Risk shape: a classic Express account, where CardPop is
// liable for unrecoverable negative balances. Only used as a fallback when
// Stripe rejects the configuration above, or when STRIPE_CONNECT_LEGACY_EXPRESS
// forces it.
export function buildLegacyExpressAccountParams(userId, opts = {}) {
  return {
    type: 'express',
    ...commonParams(userId, opts, 'express'),
  };
}

// Whether the platform has been pinned back to the legacy Express shape.
// Escape hatch so a bad interaction with Stripe can be rolled back by flipping
// one Vercel env var, without waiting on a deploy.
function legacyExpressForced() {
  return String(process.env.STRIPE_CONNECT_LEGACY_EXPRESS || '').toLowerCase() === 'true';
}

// Create a seller's Stripe account with the Managed Risk configuration, falling
// back to the legacy Express shape if — and only if — Stripe explicitly rejects
// the request (`invalid_request_error`, which is what a platform that isn't
// enabled for this configuration gets back). Connection/timeout errors are
// re-thrown untouched: retrying those with a different shape could leave a
// second orphaned account behind.
//
// Both attempts carry a stable idempotency key, so an SDK-level retry after a
// timeout can't create a duplicate account for the same seller either.
//
// Shared by the on-demand onboarding flow and the bulk backfill so the fallback
// behaviour can't drift between them.
//
// @param stripe  a Stripe client instance (passed in so this module stays
//                import-free and usable from ops scripts)
// @returns {Promise<{ account: object, config: 'managed_risk'|'express', fallbackReason?: string }>}
export async function createSellerConnectAccount(stripe, userId, opts = {}) {
  const legacyOptions = { idempotencyKey: `cardpop_seller_${userId}_express` };

  if (legacyExpressForced()) {
    const account = await stripe.accounts.create(buildLegacyExpressAccountParams(userId, opts), legacyOptions);
    return { account, config: 'express', fallbackReason: 'STRIPE_CONNECT_LEGACY_EXPRESS=true' };
  }

  try {
    const account = await stripe.accounts.create(buildSellerAccountParams(userId, opts), {
      idempotencyKey: `cardpop_seller_${userId}_managed_risk`,
    });
    return { account, config: 'managed_risk' };
  } catch (err) {
    if (err?.type !== 'invalid_request_error') throw err;

    try {
      const account = await stripe.accounts.create(buildLegacyExpressAccountParams(userId, opts), legacyOptions);
      return { account, config: 'express', fallbackReason: err.message };
    } catch {
      // The legacy shape failed too, so the problem is the request data rather
      // than the configuration — surface the original error, not the retry's.
      throw err;
    }
  }
}

// Whether a retrieved account has finished onboarding enough to be paid:
// payouts are enabled and the transfers capability is active. Read defensively.
export function isPayoutReady(account) {
  return Boolean(account?.payouts_enabled && account?.capabilities?.transfers === 'active');
}

// Who carries the loss when a retrieved account can't pay back a negative
// balance: 'stripe' (Managed Risk) or 'platform' (legacy Express — CardPop is
// debited). Stripe only returns `controller.losses` to the controlling
// platform; absent, an account predates this change, so assume platform-liable
// rather than reporting a protection that may not exist.
export function sellerLossLiability(account) {
  return account?.controller?.losses?.payments === 'stripe' ? 'stripe' : 'platform';
}

// The KYC'd legal name on a retrieved account. Individuals carry
// first/last name; companies (incl. sole traders registered as a business)
// carry a legal company name. Empty string when Stripe holds neither yet.
export function payoutAccountName(account) {
  const individual = account?.individual;
  const personal = [individual?.first_name, individual?.last_name].filter(Boolean).join(' ').trim();
  return personal || account?.company?.name || '';
}
