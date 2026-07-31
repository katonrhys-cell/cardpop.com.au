# Stripe Connect — seller payout accounts

How CardPop pays sellers, what account configuration their Connect accounts are
created with, and who carries the loss when something goes wrong.

## The money flow

CardPop uses **separate charges and transfers**:

1. The buyer is charged on the **platform** account
   (`stripe.checkout.sessions.create` in `src/routes/stripe.js`). CardPop is the
   merchant of record; the platform pays Stripe's card processing fee and keeps
   its commission.
2. When the order is confirmed, `payoutSeller()`
   (`src/services/payoutService.js`) pushes the seller's proceeds out with
   `stripe.transfers.create({ destination: <acct_…> })`.
3. Sellers who aren't Connect-onboarded get their proceeds held in
   `profiles.wallet_balance_aud` instead, released later via
   `/connect/withdraw`.

Charges never touch the seller's connected account. That matters for everything
below: the seller's account only ever *receives* transfers.

## Account configuration

New seller accounts are created with explicit **controller properties** rather
than the legacy `type: 'express'` shorthand
(`src/utils/sellerAccountShape.js` → `buildSellerAccountParams`):

| Property | Value | Effect |
|---|---|---|
| `controller.fees.payer` | `account` | Stripe-managed pricing — Stripe bills the connected account for activity on that account (i.e. its payouts) instead of billing CardPop |
| `controller.losses.payments` | `stripe` | **Managed Risk** — Stripe screens/monitors the account and carries unrecoverable negative balances |
| `controller.stripe_dashboard.type` | `express` | Express Dashboard, exactly as before |
| `controller.requirement_collection` | `stripe` | Stripe-hosted onboarding, so Account Links and `accounts.createLoginLink` keep working unchanged |

`type` and `controller` are mutually exclusive — passing both is rejected.

### What actually changes

**Loss liability, and little else.** `type: 'express'` implies
`losses.payments = 'application'`: if a seller's account goes negative and the
balance can't be recovered, CardPop is debited. The realistic path to that on
this platform is a buyer chargeback *after* the seller's payout has already left
Stripe — `reverseSellerPayout()` reverses the transfer, the seller's balance goes
below zero, and if they never top it back up the platform eats it. Under Managed
Risk that loss is Stripe's.

**Not changed:** card processing fees. `fees.payer: 'account'` only governs fees
for activity on the *seller's* account. Because the buyer is charged on the
platform, CardPop still pays the processing fee on every order and the
commission maths in `src/routes/stripe.js` is untouched. What does move to the
seller is Stripe's per-payout/per-account Connect billing — worth checking the
current AU Connect rates before announcing anything to sellers.

**Not changed:** the seller-facing flow. Onboarding is still an Account Link,
the dashboard is still `accounts.createLoginLink`, payouts are still transfers,
and `isPayoutReady()` still keys off `payouts_enabled` + an active `transfers`
capability.

### Existing sellers can't be migrated

Controller properties are fixed at creation. Every account onboarded before this
change stays platform-liable for the life of that account — there's no API call
that converts it. Coverage therefore grows only as new sellers onboard. Moving
an existing seller across would mean creating a fresh account and having them
redo KYC and bank details, which isn't worth it except for a seller who has
already cost the platform money.

`GET /connect/status` returns `lossLiability: 'stripe' | 'platform'` (read from
`account.controller.losses.payments`) so it's visible per seller which side of
the line an account falls on. Accounts also carry a
`cardpop_account_config` metadata key (`managed_risk` / `express`) set at
creation, visible in the Stripe dashboard.

## Fallback and rollback

`createSellerConnectAccount()` tries the Managed Risk shape first. If Stripe
rejects it with an `invalid_request_error` — which is what a platform that isn't
enabled for this configuration gets back — it retries once with the legacy
Express shape and returns `config: 'express'` plus the rejection reason. Both
the onboarding flow and the backfill script log that loudly, because the
resulting account is platform-liable.

This exists because the first iteration of this service targeted the v2 Accounts
API and failed in production with *"Accounts v2 is not enabled for your livemode
merchant"*, breaking seller onboarding outright. The fallback means a platform
that isn't enabled degrades to the old behaviour instead of failing.

Connection/timeout errors are **not** retried with a different shape — that
could leave a second orphaned account behind. Both attempts also carry a stable
idempotency key (`cardpop_seller_<userId>_<shape>`) for the same reason.

**Rollback:** set `STRIPE_CONNECT_LEGACY_EXPRESS=true` in Vercel to pin new
accounts back to the legacy Express shape without a deploy. Unset (or anything
other than `true`) means Managed Risk.

## Verifying it works

After the first seller onboards post-deploy:

1. Stripe Dashboard → Connect → Accounts → open the new account. It should show
   the Express dashboard type, and its metadata should read
   `cardpop_account_config: managed_risk`.
2. `GET /hcgi/api/connect/status` as that seller returns
   `"lossLiability": "stripe"`.
3. Search the logs for `fell back to legacy Express` — nothing should match. If
   something does, the platform isn't enabled for the configuration and the
   message carries Stripe's reason.

## Related files

| File | Role |
|---|---|
| `src/utils/sellerAccountShape.js` | Account shape, fallback, liability helper — shared, no imports |
| `src/services/connectService.js` | Onboarding link, status, dashboard link, wallet withdrawal |
| `src/services/payoutService.js` | Transfers out and reversals |
| `scripts/backfill-seller-connect-accounts.mjs` | Pre-creates account shells for existing sellers |
| `tests/backend/connectService.test.js` | Covers the shape, the fallback and the liability helper |
