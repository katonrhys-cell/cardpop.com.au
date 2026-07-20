# Accounts v2 marketplace — sandbox sample

Stripe's **"Collect payments using Accounts v2 as a marketplace"** blueprint, adapted to
CardPop: sellers are v2 **recipient** accounts (Express dashboard, platform as
losses/fees collector), buyers pay **the platform** through hosted Checkout, and a
**destination charge** (`payment_intent_data.transfer_data.destination`) routes the
proceeds to the seller while `application_fee_amount` keeps CardPop's commission.

> **This is the v2 twin of CardPop's real production architecture.** Production runs the
> same money flow on v1 Express accounts + transfers, because the live CardPop platform
> account (`acct_1TUPfuDQ9zWKnSHa`) rejects v2 with *"Accounts v2 is not enabled"*. Run
> this sample against a **sandbox**, where Accounts v2 is available. If Stripe enables
> Accounts v2 for livemode later, this sample is the migration reference.
>
> The sibling sample `../stripe-connect-v2-demo` covers the other blueprint (sellers as
> full-dashboard merchants taking **direct** charges + platform subscriptions). Keep the
> two separate — they are different business models.

## Get a sandbox key from the CardPop Stripe account

1. dashboard.stripe.com → tap the account name (top left, "CardPop Australia ⌄").
2. Choose **Sandboxes** (create one if none exists) and open it.
3. In the sandbox: **Developers → API keys** → copy the secret key (`sk_test_…`).

## Run

```bash
# From the repo root (uses the repo's stripe + express dependencies):
STRIPE_SECRET_KEY=sk_test_... node samples/stripe-connect-v2-marketplace-demo/server.mjs
# → http://localhost:4343
```

| Env var | Required | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | Sandbox secret key (helpful boot error if missing). |
| `CHECKOUT_WEBHOOK_SECRET` | for step 4 | `whsec_…` printed by `stripe listen` below. |
| `DEMO_BASE_URL` / `PORT` | no | Defaults `http://localhost:4343` / `4343`. |
| `DEMO_ACCOUNT_COUNTRY` / `DEMO_CURRENCY` | no | Default `au` / `aud`. |

Flow: sign in as a demo seller → **Create seller account** (v2 recipient) → **Onboard to
receive payouts** (v2 account link) → open the storefront → **Buy now** → pay with test
card `4000 0000 0000 0077` (any future expiry/CVC).

## Verify the payment (webhook)

Destination charges live on the platform, so `checkout.session.completed` is a plain
snapshot event:

```bash
stripe listen --events checkout.session.completed --forward-to localhost:4343/webhooks/checkout
```

Export the printed `whsec_…` as `CHECKOUT_WEBHOOK_SECRET` and restart. Completed sales
appear on the seller's dashboard page.

## Notes

- One shared Stripe client; no `apiVersion` argument — the SDK pins it.
- No top-level `type` on v2 accounts; the shape comes from `configuration.recipient` +
  `dashboard: 'express'` + `defaults.responsibilities` (`application` collects
  losses/fees — the platform owns the risk, unlike the direct-charge sample where
  Stripe does).
- Onboarding status is always read live from
  `v2.core.accounts.retrieve(id, { include: ['configuration.recipient', 'requirements'] })`.
- The account-link `configurations` follows the blueprint (`['recipient', 'merchant']`);
  drop `'merchant'` if your sandbox rejects it, since only recipient is configured here.
- Demo seller ↔ account-id mapping lives in a git-ignored `.demo-data.json` — in the
  real app that's `profiles.stripe_connect_account_id`.
