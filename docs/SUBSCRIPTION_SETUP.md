# CardPop Pro (Hobby vs Pro) — setup guide

CardPop has two account plans, defined in `config/plans.js`:

- **Hobby** — free, forever. Anyone can browse and buy immediately. To list,
  sell or trade, a Hobby user completes **Stripe Identity verification**; after
  that they sell for free and pay only the per-transaction fee. Hobby users are
  encouraged (never forced) to **save a card on file** for one-tap buying — it's
  never charged until they actually buy.
- **Pro** — a paid subscription (**$20 AUD/month**, with a 30-day free trial and
  a card/PayPal on file). Requires ID verification and a Stripe customer, and
  unlocks premium features, higher limits, and the Pro badge/storefront. Pro
  pays the **same** per-transaction fees as Hobby — it's for access, not fees.

> **Important model note:** the subscription no longer gates *selling*. Selling
> is gated on **identity verification** (`profiles.is_verified`) via the DB
> `can_sell()` function — see
> `supabase/migrations/20260719120000_can_sell_requires_identity_and_reset_plans.sql`.
> The Stripe/PayPal subscription described below drives the **Pro** tier only,
> mirrored onto `profiles.subscription_status` **and** `profiles.subscription_tier`
> (`'pro'` when trialing/active, `'free'` otherwise) by the webhook handlers.

## Where to change the offer

`config/subscription.js` is the single source of truth for the Pro price/trial,
used by both the frontend and backend; `config/plans.js` holds the Hobby-vs-Pro
feature/limit matrix and the plan-key helpers (`planFromTier`, `isProAccount`).

| Setting | Meaning |
|---|---|
| `TRIAL_DAYS` | Length of the Pro free trial (default `30`). |
| `REQUIRE_CARD_AT_SIGNUP` | Require a payment method to start the Pro trial. |
| `SUBSCRIPTION_PRICE_AUD` | Pro price billed after the trial (`20`; must match Stripe/PayPal). |
| `PAYMENT_PROVIDERS` | Providers offered, e.g. `['stripe', 'paypal']`. |
| `ENTITLED_STATUSES` | Statuses that grant Pro (`trialing`, `active`, `grandfathered`). |

> Changing `TRIAL_DAYS` also requires updating the trial length on the Stripe
> price / PayPal plan (below), since the provider enforces the actual trial.

## 1. Apply the database migrations

`supabase/migrations/20260701000001_add_subscription_trial.sql` adds the
subscription columns to `profiles`, a `can_sell()` function, and a **restrictive
RLS policy** on `listings`. The later
`20260719120000_can_sell_requires_identity_and_reset_plans.sql` migration
switches `can_sell()` to the **identity** gate and resets legacy grandfathered
accounts to free Hobby (everyone starts on Hobby; Pro is opt-in).

```bash
supabase db push        # or run the SQL via the Supabase dashboard
```

## 2. Stripe — recurring price with a trial

1. Create a **Product** (e.g. "CardPop Pro") and a **recurring Price**
   (`$20 AUD / month`) in the Stripe dashboard.
2. Copy the price id (`price_...`) into the env var `STRIPE_SUBSCRIPTION_PRICE_ID`.
   The trial length is applied per-checkout from `TRIAL_DAYS`, so you do **not**
   need to set a trial on the price itself.
3. Add these webhook events to your existing Stripe webhook endpoint
   (`/api/stripe/webhook`): `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `customer.subscription.trial_will_end`.

## 3. PayPal — subscription plan with a trial

1. Create a **Product** and a **Billing Plan** in PayPal with a 30-day free
   trial cycle followed by the `$20 AUD / month` regular cycle.
2. Copy the plan id (`P-...`) into `PAYPAL_SUBSCRIPTION_PLAN_ID`.
3. Create a **Webhook** pointing at `/api/subscription/paypal/webhook` subscribed
   to `BILLING.SUBSCRIPTION.*` events, and copy its id into `PAYPAL_WEBHOOK_ID`.

## 4. Environment variables

Add to Vercel (and `.env` for local dev):

| Variable | Used by |
|---|---|
| `STRIPE_SUBSCRIPTION_PRICE_ID` | Stripe subscription checkout |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal REST auth |
| `PAYPAL_SUBSCRIPTION_PLAN_ID` | PayPal subscription plan |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook verification |
| `PAYPAL_ENV` | `sandbox` or `live` |

The Stripe secret key / webhook secret are already configured for the existing
marketplace checkout and are reused here.

## How the flow works

- **Registration** (`pages/SignupPage.jsx`): after the account is created, if the
  Supabase session is live (email confirmation disabled) the user is sent to
  `/account/membership` to add a card/PayPal immediately. If email confirmation
  is **enabled**, they verify first and add the payment method on their first
  sign-in (the selling gate points them there).
- **Payment capture** (`components/StartTrialOptions.jsx`): redirects to Stripe
  Checkout (subscription mode, `trial_period_days`) or PayPal approval. No card
  data touches CardPop.
- **State sync** (`src/services/subscriptionService.js`): provider webhooks
  mirror the subscription status onto `profiles.subscription_status` /
  `trial_ends_at`.
- **Gating**: `contexts/AuthContext.jsx` derives `canSell`; the DB `can_sell()`
  RLS policy is the hard enforcement; `components/SellingGate.jsx` and the guard
  in `components/ListingForm.jsx` handle the UX.

> To collect the card strictly **during** registration, disable "Confirm email"
> in Supabase Auth so `signUp()` returns a session. Otherwise the card step
> happens at first sign-in, which is the safer default.
