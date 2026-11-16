# CardPop membership (Hobby / Pro / Ultimate) — setup guide

CardPop has three account plans, defined in `config/plans.js`:

- **Hobby** — free, and always will be. Anyone can browse and buy immediately.
  To list, sell or trade, a Hobby user completes **Stripe Identity
  verification** *and* keeps a **card on file** (so the per-sale/trade fee can
  always be collected — trades have no proceeds to net it from). The card is
  never charged until a sale or trade actually completes. Hobby can create
  **5 new listings per calendar month** and gets no storefront — with one
  exception: a sole trader an admin has flagged as a **featured seller**
  (`is_featured_seller`, the homepage Trusted Sellers strip) keeps a live
  `/dealer` store page on Hobby, since a hand-picked dealer needs a store to
  send visitors to.
- **Pro — $99 AUD a year.** For vendors and avid traders: **30 listings a
  month**, a **store page** on the Local Traders directory, the Pro display
  styles (Premium Stand, Floating, Neon Glow, Glass Museum, Slab Display,
  Spotlight), Whatnot show listings and the homepage Featured Cards spots.
- **Ultimate — $199 AUD a year.** For show organisers: everything in Pro,
  **unlimited listings**, every display style, Featured Seller placement on the
  homepage, and **Calendar Spotlight on every event the member runs** (see
  *Ultimate: Calendar Spotlight* below).

Both paid plans are **yearly, auto-renewing Stripe subscriptions charged in
full at sign-up — there is no free trial.** The price is flat and
GST-inclusive: the member pays exactly $99 / $199, nothing is added at
checkout. Out of that CardPop remits the GST (1/11 — about $9 / $18.09) and
pays Stripe's fee, so it nets roughly $88 / $177 per member per year. Every
plan pays the **same** per-transaction fees as Hobby — a membership buys
access, not lower fees — and the per-sale costs (payment processing, GST) are
carried by the sale itself, never by the membership (`docs/order-pricing.md`).

> **History (2026-11).** There used to be four monthly tiers — Pro $20,
> Premium $40, Elite $80, Ultimate $150 — each with a 30-day free trial.
> Premium was folded into Pro and Elite into Ultimate
> (`20261116005126_membership_two_yearly_plans.sql`; `canonicalTier()` in
> `config/subscription.js` still maps the retired names). Nobody was on a paid
> plan at the time, so there was no one to migrate. The welcome code no longer
> carries a trial either — it is the 10% first-order discount only
> (`WELCOME_TRIAL_DAYS = 0`).

> **Important model note:** the subscription does not gate *selling* outright.
> Selling is gated on **identity verification** (`profiles.is_verified`) **and
> a card on file** (`profiles.has_saved_card`) via the DB `can_sell()` function
> — see `supabase/migrations/20260728205156_fix_selling_gate_uses_stale_private_can_sell.sql`.
> What the paid plans change is the **monthly listing quota** (enforced by the
> `enforce_monthly_listing_quota` BEFORE INSERT trigger on `public.listings`),
> the storefront/display-style perks and, on Ultimate, event featuring. The
> Stripe subscription drives `profiles.subscription_status` **and**
> `profiles.subscription_tier` (the plan whose price the subscription bills
> when active, `'free'` otherwise) via the webhook handlers. Which plan a
> subscription buys is resolved from the `tier` stamped in the subscription
> metadata — see `tierFromStripeSubscription` in
> `src/services/subscriptionService.js`.

## Ultimate: Calendar Spotlight on every event

An Ultimate member's events are featured automatically — the same placement the
$49 *Calendar Spotlight* package buys (`utils/featuredPackages.js`): the
Featured events strip above the calendar, first in its month, and a Featured
badge. It is done in the database
(`20261116005126_membership_two_yearly_plans.sql`), so no code path can forget
it:

- `trg_membership_event_spotlight` (BEFORE INSERT / UPDATE on `events`) switches
  `is_featured` on when an Ultimate member creates an event or an admin links
  one to them, and records that in **`events.membership_featured`**.
- `trg_sync_membership_event_spotlight` (AFTER INSERT / UPDATE OF
  `subscription_tier`, `is_admin` on `profiles`) switches it on for all of a
  member's events when they join Ultimate, and off again when the membership
  ends — **only for the events the membership switched on**. An event an admin
  pinned, or one with its own paid featuring (`event_feature_purchases`), keeps
  its placement.
- **Admins are excluded** (`membership_spotlight_applies()`): their Ultimate is
  complimentary and they enter most of the calendar on other organisers'
  behalf. `hasEventSpotlight()` in `config/plans.js` is the JS mirror.
- `membership_featured` is bookkeeping a member can never write (clearing it
  would let the placement outlive the membership).
- A failed renewal drops the tier to Hobby while Stripe retries, so the
  spotlight pauses with it and returns when the payment succeeds.
- Account → My Events shows **Featured · Ultimate** on those events and offers
  no *Feature* button (`featureEligibility()`). Pro and Hobby organisers buy
  Calendar Spotlight per event ($49) as before.
- **Membership and promotion extras never overlap.** The membership is the
  placement on the site; the extras (Instagram story $49, Instagram post $99,
  full event review $199) are hand-done promotion sold per event to any
  organiser, Ultimate included, at the same price — see
  `docs/event-featuring.md` → Promotion extras. A paid extra is not a
  featuring: it does not keep an event featured when the membership ends.

Test: `tests/db/run-membership-plans-migration.sh`.

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
  → Membership show "complimentary" / "Included free" instead of the $199 a
  year the member never pays, and offer nothing to buy.

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
| `admin@cardpop.com.au` (platform store + admin login) | `20260806064711_…` (the then-Premium tier) raised to Ultimate by `20261004064733_…` |

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

`config/subscription.js` is the single source of truth for prices and billing,
used by both the frontend and backend; `config/plans.js` holds the per-plan
feature/limit matrix and the plan-key helpers (`planKeyFromTier`,
`isProAccount`, `hasStorefront`, `hasEventSpotlight`, `listingsPerMonthForTier`).

| Setting | Meaning |
|---|---|
| `TIER_PRICES_AUD` | Yearly price per paid plan (`{ pro: 99, ultimate: 199 }`). Must match the Stripe prices — checkout refuses (503) a price that doesn't. |
| `SUBSCRIPTION_INTERVAL` | `'year'`. |
| `TRIAL_DAYS` | `0` — charged at sign-up. A number here brings a free trial back (the trial plumbing is still understood everywhere). |
| `PAYMENT_PROVIDERS` | Providers offered — `['stripe']`. |
| `ENTITLED_STATUSES` | Statuses that grant the paid plan (`trialing`, `active`, `grandfathered`). |
| `LEGACY_TIER_MAP` / `canonicalTier()` | The retired tier names → the plan that absorbed them. |

> Changing a **price** means creating a new Stripe price and pointing the env
> var at it (Stripe prices are immutable), then changing `TIER_PRICES_AUD`.
>
> Changing a **monthly listing limit** means changing it in BOTH
> `config/plans.js` (`LISTINGS_PER_MONTH`) and the
> `enforce_monthly_listing_quota` trigger (new migration) — the DB is the
> enforcement point, the config is what the UI displays. The pricing copy in
> `api/prerender.js` is hand-written and checked by a test.

## 1. Apply the database migrations

`20260701000001_add_subscription_trial.sql` added the subscription columns;
`20260630000002_add_display_styles.sql` added `subscription_tier`;
`20260802060200_lock_profiles_subscription_tier.sql` pins `subscription_tier`
against user self-writes (only the service-role webhook flow may set it); and
`20261116005126_membership_two_yearly_plans.sql` narrows the tier CHECK to
`free | pro | ultimate`, sets the listing quota (5 / 30 / unlimited), opens
Whatnot show listings to Pro, and adds the Ultimate event spotlight.

Migrations apply automatically on merge to `main` (see CLAUDE.md).

## 2. Stripe — one yearly price per paid plan

1. Create a **Product** per plan ("CardPop Pro", "CardPop Ultimate") and a
   **recurring Price** on each: **$99.00 AUD every year** and **$199.00 AUD
   every year**. Set the price's tax behaviour to *inclusive* if Stripe Tax is
   ever switched on — the advertised price includes GST.
2. Copy each price id (`price_...`) into its env var:
   **`STRIPE_MEMBERSHIP_PRICE_ID_PRO`** and
   **`STRIPE_SUBSCRIPTION_PRICE_ID_ULTIMATE`**. A plan whose price id is unset
   can't be purchased (its checkout answers 503). Ultimate keeps the
   variable name it always had, now holding the yearly price; Pro has a new
   one. Sign-up checkout **and** plan changes go through
   `resolveMembershipPrice()`, which retrieves the price and refuses it (503)
   unless it is an active AUD price of exactly the plan's amount billed once a
   year — so a stale monthly id left in either variable can't bill a member
   something the page didn't say.
3. The other old monthly variables — `STRIPE_SUBSCRIPTION_PRICE_ID`,
   `…_PREMIUM`, `…_ELITE` — are **no longer read**. Delete them, and archive
   the old monthly prices in Stripe.
4. The app webhook endpoint (`/api/stripe/webhook`) needs these events:
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `customer.subscription.trial_will_end`,
   `invoice.payment_failed` and **`invoice.upcoming`** (the renewal reminder).
5. In Stripe → Settings → Billing → *Subscriptions and emails*, set **Upcoming
   renewal events** to the lead time you want the reminder sent at (30 days is
   sensible for a yearly charge). Stripe sends `invoice.upcoming` that many
   days before each renewal.

## 3. PayPal — currently switched OFF

Memberships are billed through **Stripe only**: `PAYMENT_PROVIDERS` in
`config/subscription.js` is `['stripe']`, so the PayPal button never renders.
The PayPal machinery (routes, client, webhook handler) remains in the codebase
and fails safe while unconfigured. To re-enable it later: create a yearly
Billing Plan per paid plan in PayPal, copy the plan ids into
`PAYPAL_SUBSCRIPTION_PLAN_ID` (Pro) and `PAYPAL_SUBSCRIPTION_PLAN_ID_ULTIMATE`,
create a webhook at `/api/subscription/paypal/webhook` for
`BILLING.SUBSCRIPTION.*` (id into `PAYPAL_WEBHOOK_ID`), and add `'paypal'` back
to `PAYMENT_PROVIDERS`.

## 4. Environment variables

Add to Vercel (and `.env` for local dev):

| Variable | Used by |
|---|---|
| `STRIPE_MEMBERSHIP_PRICE_ID_PRO` | Stripe checkout and plan changes — Pro ($99 / year) |
| `STRIPE_SUBSCRIPTION_PRICE_ID_ULTIMATE` | Stripe checkout — Ultimate ($199 / year) |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal REST auth (off) |
| `PAYPAL_SUBSCRIPTION_PLAN_ID` / `_ULTIMATE` | PayPal plans (off) |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook verification (off) |
| `PAYPAL_ENV` | `sandbox` or `live` |

The Stripe secret key / webhook secret are already configured for the existing
marketplace checkout and are reused here.

## How the flow works

- **Choosing a plan** (`pages/PricingPage.jsx` → `/account/membership?tier=…`):
  the pricing page links each paid plan to the membership page with the plan
  preselected; the member can switch there before checkout.
- **Joining** (`components/StartTrialOptions.jsx` — the name is from the trial
  era): redirects to Stripe Checkout (subscription mode, the plan's yearly
  price, `tier` stamped in the subscription metadata, no `trial_period_days`).
  The first year is charged there and then; no card data touches CardPop.
- **Changing plan** (Account → Membership → *Change your plan* →
  `POST /subscription/stripe/change-tier`, `changeStripeSubscriptionTier()`):
  the existing subscription's item is re-priced in place, keeping the renewal
  date and the card. **An upgrade (Pro → Ultimate) is invoiced and charged
  immediately** for the pro-rated difference over the rest of the year
  (`proration_behavior: 'always_invoice'`) — on a yearly plan "the next
  invoice" could be twelve months away. A declined card refuses the upgrade
  (`payment_behavior: 'error_if_incomplete'` → 402) and changes nothing. **A
  downgrade (Ultimate → Pro)** credits the unused part of the dearer plan
  against the next renewal (`create_prorations`); nothing is refunded to the
  card. Hobby members take the sign-up checkout instead; a complimentary
  (`grandfathered`) membership gets a 409. The route is MFA-gated
  (`requireAal2`) like the other routes that change what the card is charged.
  Dropping to Hobby is a cancellation, not a plan change.
- **Cancelling** (Account → Membership → *Cancel membership* →
  `POST /subscription/stripe/cancel`, `cancelStripeMembership()`): an active
  member is cancelled **at the end of the year they have paid for**
  (`cancel_at_period_end` — no refund of the current year, no further charge)
  and can undo it until then (*Keep my membership* → `/stripe/resume`); a member whose
  payment is failing is cancelled **immediately** and the unpaid invoice
  voided, so the retries stop. The page reads the live state from
  `GET /subscription/stripe/details`. Members never get Stripe access — every
  action is a call to our API, which makes the change in Stripe.
- **Updating the card** (*Update card* → `POST /subscription/stripe/update-card`,
  `createMembershipCardSession()`): a Checkout Session in `setup` mode (the same
  hosted card step as sign-up, no charge). On return the page calls
  `/stripe/update-card/confirm`, and the `checkout.session.completed` webhook
  does the same (`applyMembershipCardFromSession()`, idempotent): the card
  becomes the customer's and the subscription's default payment method, and a
  `past_due` membership's open invoice is retried on it at once so the plan is
  restored straight away. Stripe's own Customer portal is not used. The
  writes are MFA-gated (`requireAal2`).
- **Renewal reminder**: `invoice.upcoming` (sent by Stripe the configured
  number of days before each yearly renewal) emails the member the charge
  date, the amount and where to cancel (`sendRenewalReminder()` →
  `membershipRenewalEmail`) — skipped once they've cancelled, and for
  complimentary members. (`customer.subscription.trial_will_end` still sends
  the trial version, should `TRIAL_DAYS` ever be non-zero.)
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
