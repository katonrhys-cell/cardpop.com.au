# CardPop membership tiers (Hobby / Pro / Premium / Elite / Ultimate) — setup guide

CardPop has five account plans, defined in `config/plans.js`:

- **Hobby** — free, forever. Anyone can browse and buy immediately. To list,
  sell or trade, a Hobby user completes **Stripe Identity verification** *and*
  keeps a **card on file** (so the per-sale/trade fee can always be collected —
  trades have no proceeds to net it from). The card is never charged until a
  sale or trade actually completes. Hobby can create **5 new listings per
  calendar month** and gets no storefront — with one exception: a sole
  trader an admin has flagged as a **featured seller** (`is_featured_seller`,
  the homepage Trusted Sellers strip) keeps a live `/dealer` store page on
  Hobby, since a hand-picked dealer needs a store to send visitors to.
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
self-writes, so the grant has to be made service-side.

### Every admin holds Ultimate, free

Admin access **includes the Ultimate plan at no charge**. This is a rule, not a
per-account grant (`20261023032430_admins_hold_complimentary_ultimate.sql`):

- **Database** — `trg_sync_admin_complimentary_membership` (BEFORE INSERT /
  UPDATE OF `is_admin` on `profiles`) sets `subscription_tier = 'ultimate'`,
  `subscription_status = 'grandfathered'` and clears `trial_ends_at` whenever
  `is_admin` is written as `true`, and on demotion (`true → false`) returns a
  *complimentary* member to Hobby (`'free'` / `'none'`). A real paid
  subscription (any other status) is never touched by a demotion. The
  migration backfilled every existing admin. Test:
  `tests/db/run-admin-membership-migration.sh`.
- **Server** — the part a trigger can't do: an admin must never be *billed*.
  `PATCH /admin/users/:id/role` (Admin → Users → Make Admin) calls
  `grantAdminComplimentaryMembership()` (`src/services/subscriptionService.js`)
  **before** flipping `is_admin`: it cancels any live Stripe subscription the
  account was paying for (immediately, `invoice_now: false`, so no final
  charge), clears `stripe_subscription_id`, and writes the plan columns. If
  the cancel fails the promotion fails with it — an admin left paying for a
  plan they now hold free is exactly the bill the rule exists to prevent.
  Demotion calls `revokeAdminComplimentaryMembership()`. A live **PayPal**
  subscription can't be cancelled from here (PayPal billing is switched off);
  it is logged as an error to cancel in the PayPal dashboard.
- **Checkout** — `POST /subscription/stripe/checkout` and
  `/subscription/paypal/create` answer **409** for an admin or any
  complimentary member (`assertCanStartPaidMembership()`), so a plan can't be
  bought by an account that already holds the top tier for free. (Before this
  the checkout created a Stripe subscription the profile then ignored — a bill
  for nothing.) `/stripe/change-tier` already refused complimentary members.
- **UI** — Account → Dashboard (`components/AccountPlanBanner.jsx`) and Account
  → Membership show "complimentary" / "Included free" instead of the $150/mo
  the member never pays, and offer no trial or upgrade.

If an existing admin was mid-way through a paid Stripe subscription when the
migration landed, the backfill granted Ultimate but the DB could not cancel
Stripe — find them with
`select id, stripe_subscription_id from profiles where is_admin and stripe_subscription_id is not null`
and cancel in the Stripe dashboard.

### Per-account comps

The earlier per-email grants are still in the repo and still valid, and are
now also covered by the admin rule (all three accounts are admins):

| Account | Migration |
|---|---|
| `katonrhys@gmail.com` (owner) | `20260802062300_grant_owner_ultimate_membership.sql`, re-asserted by `20261004064733_…` |
| `rfkates09@hotmail.com` (owner) | `20261004064733_grant_admin_accounts_ultimate_membership.sql` |
| `admin@cardpop.com.au` (platform store + admin login) | `20260806064711_…` (Premium) raised to Ultimate by `20261004064733_…` |

To comp a **non-admin** account, add a new migration in the same shape (keyed
on `lower(auth.users.email)`, idempotent). `applyStripeSubscription` /
`applyPaypalSubscription` (`src/services/subscriptionService.js`) skip any
profile whose status is `grandfathered` (`COMPLIMENTARY_STATUS`), so a provider
event about a comped account — a stray cancel, a PayPal `create` — can never
downgrade it. To *revoke* a non-admin comp, a migration sets the status back to
`'none'` and the tier to `'free'` (an admin's comp is revoked by removing admin
access).

Besides the plan itself, admins are exempt from the monthly listing quota
trigger and the Whatnot-shows insert policy.

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
   `customer.subscription.trial_will_end`, **`invoice.payment_failed`**.

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
- **Upgrading an existing paid tier** (Account → Dashboard "Upgrade your
  plan" → `/account/membership?tier=…` → `POST /subscription/stripe/change-tier`,
  `changeStripeSubscriptionTier()` in `src/services/subscriptionService.js`):
  the dashboard's plan card (`components/AccountPlanBanner.jsx`) shows the
  whole ladder with the member's step marked and an **Upgrade your plan**
  button for everyone but Ultimate (`isTopPlan()` / `nextPlanFor()` in
  `config/plans.js`). A paid Stripe member upgrades *in place*: the existing
  subscription's item is re-priced with `create_prorations` and its `tier`
  metadata rewritten, so they keep their billing anchor, trial and card — no
  second subscription, no second trial. Hobby members take the trial checkout
  instead; a PayPal-billed or complimentary (`grandfathered`) membership gets a
  409 and a message. The route is MFA-gated (`requireAal2`) like the other
  routes that change what the member's card is charged.
- **Downgrading** goes through the same route and the membership page's
  *Change your plan* grid (every other paid tier, labelled Upgrade/Downgrade):
  the item is re-priced with `create_prorations`, so the unused part of the
  dearer plan is credited against the next invoice. Dropping to Hobby is a
  cancellation, not a tier change.
- **Cancelling** (Account → Membership → *Cancel membership* →
  `POST /subscription/stripe/cancel`, `cancelStripeMembership()`): a trialing
  or active member is cancelled **at the end of the period they already have**
  (`cancel_at_period_end` — a trial ends without ever being charged) and can
  undo it until then (*Keep my membership* → `/stripe/resume`); a member whose
  payment is failing is cancelled **immediately** and the unpaid invoice
  voided, so the retries stop. The page reads the live state from
  `GET /subscription/stripe/details`. Members never get Stripe access — every
  action is a call to our API, which makes the change in Stripe.
- **Updating the card** (*Update card* → `POST /subscription/stripe/update-card`,
  `createMembershipCardSession()`): a Checkout Session in `setup` mode (the same
  hosted card step as the trial sign-up, no charge). On return the page calls
  `/stripe/update-card/confirm`, and the `checkout.session.completed` webhook
  does the same (`applyMembershipCardFromSession()`, idempotent): the card
  becomes the customer's and the subscription's default payment method, and a
  `past_due` membership's open invoice is retried on it at once so the plan is
  restored straight away. Stripe's own Customer portal is not used. The
  writes are MFA-gated (`requireAal2`).
- **Trial reminder**: `customer.subscription.trial_will_end` (3 days out)
  emails the member the charge date, the amount and where to cancel
  (`membershipTrialEndingEmail`) — skipped once they've cancelled.
- **A failed first charge ends the membership** (`endFailedTrialConversion()`):
  when a subscription goes `past_due` and has never collected a payment (the
  trial converted and the card declined), it is cancelled and its open invoice
  voided rather than left on Stripe's retry schedule. Before this the profile
  dropped to Hobby while Stripe kept retrying the card for days — members saw
  "payment failed" notices for a plan their account said they weren't on
  (support case, 2026-10-25). A member who has paid before keeps Stripe's
  retries on a failed renewal, and the membership page shows them *Payment
  failed* with *Update card* / *Cancel membership*. `invoice.payment_failed`
  re-applies the subscription so this runs on every retry, not only on a
  status change.
- **State sync** (`src/services/subscriptionService.js`): provider webhooks
  mirror the subscription status onto `profiles.subscription_status` /
  `trial_ends_at`, and the purchased tier onto `profiles.subscription_tier`.
- **Gating**: `contexts/AuthContext.jsx` derives `canSell` / `isPro` /
  `subscriptionTier`; the DB `can_sell()` RLS policy and the
  `enforce_monthly_listing_quota` trigger are the hard enforcement;
  `components/SellingRequirementsNotice.jsx` and the quota toasts
  (`utils/listingErrors.js`) handle the UX. Store pages are gated by
  `hasStorefront()` (paid tier, entitled status, or admin-featured) in
  `components/FeaturedSellerCard.jsx`, `pages/SoleTraderStorePage.jsx` and
  `api/prerender.js`; the list queries in `pages/community/LocalTradersPage.jsx`,
  `api/sitemap.js` and the prerendered directory use the matching
  `STOREFRONT_FILTER` from `config/plans.js` — change the two together.

> To collect the card strictly **during** registration, disable "Confirm email"
> in Supabase Auth so `signUp()` returns a session. Otherwise the card step
> happens at first sign-in, which is the safer default.
