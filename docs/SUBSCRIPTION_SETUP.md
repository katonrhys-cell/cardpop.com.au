# CardPop membership tiers (Hobby / Pro / Premium / Elite / Ultimate) — setup guide

CardPop has five account plans, defined in `config/plans.js`:

- **Hobby** — free, forever. Anyone can browse and buy immediately. To list,
  sell or trade, a Hobby user completes **Stripe Identity verification** *and*
  keeps a **card on file** (so the per-sale/trade fee can always be collected —
  trades have no proceeds to net it from). The card is never charged until a
  sale or trade actually completes. Hobby can create **5 new listings per
  calendar month** and never gets a storefront.
- **Pro / Premium / Elite / Ultimate** — paid monthly subscriptions
  (**$20 / $40 / $80 / $150 AUD/month**, each with a 30-day free trial and a
  card/PayPal on file). Every paid tier requires ID verification and a Stripe
  customer, and unlocks a bigger monthly listing allowance
  (**15 / 30 / 50 / unlimited**), a **store page** on the Local Traders
  directory, and progressively fancier Vault display styles (see
  `lib/displayStyles.js` — access is cumulative). Every tier pays the **same**
  per-transaction fees as Hobby — the subscription is for access, not fees.

> **Important model note:** the subscription does not gate *selling* outright.
> Selling is gated on **identity verification** (`profiles.is_verified`) **and
> a card on file** (`profiles.has_saved_card`) via the DB `can_sell()` function
> — see `supabase/migrations/20260728205156_fix_selling_gate_uses_stale_private_can_sell.sql`.
> What the paid tiers change is the **monthly listing quota** (enforced by the
> `enforce_monthly_listing_quota` BEFORE INSERT trigger on `public.listings`)
> and the storefront/display-style perks. The Stripe/PayPal subscription drives
> `profiles.subscription_status` **and** `profiles.subscription_tier` (the tier
> whose price the subscription bills when trialing/active, `'free'` otherwise)
> via the webhook handlers. Which paid tier a subscription buys is resolved from
> the `tier` stamped in the subscription metadata (Stripe) or the billing plan
> id (PayPal) — see `tierFromStripeSubscription` / `tierFromPaypalPlanId` in
> `src/services/subscriptionService.js`.

## Complimentary (free) memberships

A tier can be granted with no Stripe/PayPal subscription behind it by setting
`profiles.subscription_status = 'grandfathered'` alongside the tier. That status
is in `ENTITLED_STATUSES`, so the app treats the account as a paying member of
that tier, and **no provider webhook ever emits it**, so nothing external flips
it back. Both `subscription_tier` and `subscription_status` are locked against
self-writes, so the grant has to be made service-side — by migration, which is
the repeatable, production-applied way (never the SQL editor; see CLAUDE.md).

Current grants (all **Ultimate**, the top tier, at no cost):

| Account | Migration |
|---|---|
| `katonrhys@gmail.com` (owner) | `20260802062300_grant_owner_ultimate_membership.sql`, re-asserted by `20261004064733_…` |
| `rfkates09@hotmail.com` (owner) | `20261004064733_grant_admin_accounts_ultimate_membership.sql` |
| `admin@cardpop.com.au` (platform store + admin login) | `20260806064711_…` (Premium) raised to Ultimate by `20261004064733_…` |

To comp another account, add a new migration in the same shape (keyed on
`lower(auth.users.email)`, idempotent). `applyStripeSubscription` /
`applyPaypalSubscription` (`src/services/subscriptionService.js`) skip any
profile whose status is `grandfathered` (`COMPLIMENTARY_STATUS`), so a provider
event about a comped account — a stray cancel, a PayPal `create` — can never
downgrade it. To *revoke* a comp, a migration sets the status back to `'none'`
and the tier to `'free'`.

Note that being an admin (`profiles.is_admin`) does **not** by itself confer a
tier — admin access and membership are separate grants. The only admin
exemptions in the tier system are the monthly listing quota trigger and the
Whatnot-shows insert policy.

## Where to change the offer

`config/subscription.js` is the single source of truth for prices/trial,
used by both the frontend and backend; `config/plans.js` holds the per-tier
feature/limit matrix and the plan-key helpers (`planKeyFromTier`,
`isProAccount`, `hasStorefront`, `listingsPerMonthForTier`).

| Setting | Meaning |
|---|---|
| `TRIAL_DAYS` | Length of the free trial (default `30`, all paid tiers). |
| `REQUIRE_CARD_AT_SIGNUP` | Require a payment method to start the trial. |
| `TIER_PRICES_AUD` | Monthly price per paid tier (`{ pro: 20, premium: 40, elite: 80, ultimate: 150 }`; must match Stripe/PayPal). |
| `PAYMENT_PROVIDERS` | Providers offered, e.g. `['stripe', 'paypal']`. |
| `ENTITLED_STATUSES` | Statuses that grant the paid tier (`trialing`, `active`, `grandfathered`). |

> Changing `TRIAL_DAYS` also requires updating the trial length on the PayPal
> plans (below), since PayPal enforces the actual trial there. Stripe applies
> the trial per-checkout from `TRIAL_DAYS`.
>
> Changing a **monthly listing limit** means changing it in BOTH
> `config/plans.js` (`LISTINGS_PER_MONTH`) and the
> `enforce_monthly_listing_quota` trigger (new migration) — the DB is the
> enforcement point, the config is what the UI displays.

## 1. Apply the database migrations

`supabase/migrations/20260701000001_add_subscription_trial.sql` added the
subscription columns; `20260630000002_add_display_styles.sql` added
`subscription_tier`; `20260802060100_enforce_monthly_listing_quota.sql` adds
the per-tier monthly listing quota trigger; and
`20260802060200_lock_profiles_subscription_tier.sql` pins `subscription_tier`
against user self-writes (only the service-role webhook flow may set it).

Migrations apply automatically on merge to `main` (see CLAUDE.md); locally:

```bash
supabase db push
```

## 2. Stripe — one recurring price per paid tier

1. Create a **Product** per tier (e.g. "CardPop Pro", "CardPop Premium", …) and
   a **recurring Price** for each (`$20 / $40 / $80 / $150 AUD / month`).
2. Copy each price id (`price_...`) into its env var:
   `STRIPE_SUBSCRIPTION_PRICE_ID` (Pro — legacy un-suffixed name),
   `STRIPE_SUBSCRIPTION_PRICE_ID_PREMIUM`, `STRIPE_SUBSCRIPTION_PRICE_ID_ELITE`,
   `STRIPE_SUBSCRIPTION_PRICE_ID_ULTIMATE`. A tier whose price id is unset
   simply can't be purchased (its checkout answers 503); the others keep
   working. The trial length is applied per-checkout from `TRIAL_DAYS`, so you
   do **not** need to set a trial on the prices themselves.
3. Add these webhook events to your existing Stripe webhook endpoint
   (`/api/stripe/webhook`): `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `customer.subscription.trial_will_end`.

## 3. PayPal — currently switched OFF

Memberships are billed through **Stripe only**: `PAYMENT_PROVIDERS` in
`config/subscription.js` is `['stripe']`, so the PayPal button never renders.
The PayPal machinery (routes, client, webhook handler) remains in the codebase
and fails safe while unconfigured. To re-enable it later:

1. Create a **Product** and a **Billing Plan** per tier in PayPal, each with a
   30-day free trial cycle followed by the tier's regular monthly cycle.
2. Copy each plan id (`P-...`) into its env var:
   `PAYPAL_SUBSCRIPTION_PLAN_ID` (Pro — legacy un-suffixed name),
   `PAYPAL_SUBSCRIPTION_PLAN_ID_PREMIUM`, `PAYPAL_SUBSCRIPTION_PLAN_ID_ELITE`,
   `PAYPAL_SUBSCRIPTION_PLAN_ID_ULTIMATE`.
3. Create a **Webhook** pointing at `/api/subscription/paypal/webhook` subscribed
   to `BILLING.SUBSCRIPTION.*` events, and copy its id into `PAYPAL_WEBHOOK_ID`.
4. Add `'paypal'` back to `PAYMENT_PROVIDERS`.

## 4. Environment variables

Add to Vercel (and `.env` for local dev):

| Variable | Used by |
|---|---|
| `STRIPE_SUBSCRIPTION_PRICE_ID` | Stripe checkout — Pro |
| `STRIPE_SUBSCRIPTION_PRICE_ID_PREMIUM` / `_ELITE` / `_ULTIMATE` | Stripe checkout — higher tiers |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal REST auth |
| `PAYPAL_SUBSCRIPTION_PLAN_ID` | PayPal plan — Pro |
| `PAYPAL_SUBSCRIPTION_PLAN_ID_PREMIUM` / `_ELITE` / `_ULTIMATE` | PayPal plans — higher tiers |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook verification |
| `PAYPAL_ENV` | `sandbox` or `live` |

The Stripe secret key / webhook secret are already configured for the existing
marketplace checkout and are reused here.

## How the flow works

- **Choosing a tier** (`pages/PricingPage.jsx` → `/account/membership?tier=…`):
  the pricing page links each paid plan to the membership page with the tier
  preselected; the member can switch tiers there before checkout.
- **Payment capture** (`components/StartTrialOptions.jsx`): redirects to Stripe
  Checkout (subscription mode, `trial_period_days`, the tier's price, `tier`
  stamped in the subscription metadata) or PayPal approval (the tier's plan).
  No card data touches CardPop.
- **State sync** (`src/services/subscriptionService.js`): provider webhooks
  mirror the subscription status onto `profiles.subscription_status` /
  `trial_ends_at`, and the purchased tier onto `profiles.subscription_tier`.
- **Gating**: `contexts/AuthContext.jsx` derives `canSell` / `isPro` /
  `subscriptionTier`; the DB `can_sell()` RLS policy and the
  `enforce_monthly_listing_quota` trigger are the hard enforcement;
  `components/SellingRequirementsNotice.jsx` and the quota toasts
  (`utils/listingErrors.js`) handle the UX. Store pages are filtered to paid
  tiers in `pages/community/LocalTradersPage.jsx`, `pages/SoleTraderStorePage.jsx`,
  `api/prerender.js` and `api/sitemap.js`.

> To collect the card strictly **during** registration, disable "Confirm email"
> in Supabase Auth so `signUp()` returns a session. Otherwise the card step
> happens at first sign-in, which is the safer default.
