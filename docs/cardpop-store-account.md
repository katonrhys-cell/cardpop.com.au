# The CardPop store account (`admin@cardpop.com.au`)

CardPop sells on its own marketplace. This is the account it sells from: an
admin login that also owns a dealer store at `/dealer/cardpop`.

It is not a normal signup. Six things have to be true before that store exists
and can list a card, and **every one of them is a column a signed-in user is
forbidden from writing to themselves** — the `profiles_update_access` policy
(`20260802060200_lock_profiles_subscription_tier.sql`) pins `is_admin`,
`is_verified`, `verification_status`, `has_saved_card`, `subscription_tier` and
`subscription_status` against self-writes, precisely so nobody can self-grant
them with the shipped anon key. So they are granted service-side.

| Requirement | Column(s) | Enforced by |
|---|---|---|
| Admin panel access | `is_admin` | `ProtectedAdminRoute` + `isAdminUser` (backend). `trg_sync_admin_app_metadata` mirrors it into the JWT |
| ID verified | `is_verified`, `verification_status` | `private.can_sell()`, plus the verified badge in the UI |
| Can list | `has_saved_card` | `private.can_sell()` → RESTRICTIVE policy `listings_require_selling_entitlement` on `listings` |
| Ultimate membership | `subscription_tier='ultimate'`, `subscription_status='grandfathered'` | `config/plans.js` (`hasStorefront`, `canListWhatnotShows`), `enforce_monthly_listing_quota` trigger |
| Dealer store renders | `is_sole_trader`, `store_slug`, `is_public` | `SoleTraderStorePage` refuses to render without all three |
| Email confirmed | `auth.users.email_confirmed_at` | `email_verification_ok()` → RESTRICTIVE policy `listings_require_email_verified` |

Why **Ultimate**: it was first provisioned at Premium (the tier where Whatnot
show listings, the homepage Featured Cards spots and priority Local Traders
placement start), and later raised to the top tier by
`20261004064733_grant_admin_accounts_ultimate_membership.sql` so the
platform's own accounts hold every perk (unlimited listings, every display
style) at no cost.

Why `subscription_status = 'grandfathered'`: it is the status
`config/subscription.js` treats as entitled with no Stripe/PayPal subscription
behind it, and **no provider webhook ever emits it** — so nothing external will
flip it back. Same trick as the owner account
(`20260802062300_grant_owner_ultimate_membership.sql`). Since
`20261023032430_admins_hold_complimentary_ultimate.sql` this is the rule for
**every** admin — `is_admin = true` grants complimentary Ultimate by trigger,
so this account would hold it even without its own migration (see
`docs/SUBSCRIPTION_SETUP.md` → Complimentary memberships).

## How it gets provisioned

Two pieces, both idempotent, and safe to run in either order:

- **`scripts/create-cardpop-store-account.mjs`** creates the *auth user*. A
  migration can't do this properly — GoTrue owns `auth.users` / `auth.identities`
  and its own password hashing — so the script goes through the Auth Admin API
  with `email_confirm: true`. It then applies every entitlement above.
- **`supabase/migrations/20260806064711_provision_cardpop_store_account.sql`**
  applies the same entitlements, keyed on the account's email. It is a **no-op
  until the auth user exists**, and re-asserts the values on every fresh
  `db push` — so if the account is ever created by hand in the dashboard, or a
  column gets clobbered, the migration heals it.

```bash
SUPABASE_URL=https://vrfsaazuqjxotnieqlkd.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
STORE_ACCOUNT_PASSWORD='<password>' \
node scripts/create-cardpop-store-account.mjs --dry-run
```

Drop `--dry-run` to apply. Omit `STORE_ACCOUNT_PASSWORD` and a strong random
password is generated and printed once. `--reset-password` rotates the password
of an account that already exists. Flags: `--email`, `--slug`, `--username`,
`--business-name`.

## Two grants that are asserted, not earned

Both are deliberate, and both would be wrong on a real seller's account:

- **`is_verified` / `verification_status = 'approved'`** are set without a
  Stripe Identity session. This is the platform's own account — there is no
  third party to verify. For a real seller, always route through
  `identityService`.
- **`has_saved_card`** is set without a card being attached in Stripe. It means
  "this account may list", not "Stripe holds a payment method". The account is
  the *seller*, so it is not normally charged; if it ever needs to be, attach a
  real card first. The Stripe setup-intent flow only ever sets this column
  true, so it will never conflict.

## The one step that can't be automated

**Stripe Connect payout onboarding.** `stripe_connect_account_id` /
`stripe_connect_onboarded` come from a KYC flow a human has to complete from
**Account → Payouts** in the app. Until that's done the store can list and sell
fine, but proceeds accumulate in the seller wallet instead of paying out — see
`docs/stripe-connect.md`.

## Operational notes

- **Make sure the mailbox exists.** `admin@cardpop.com.au` is a Google Workspace
  address (`docs/email.md`). Password resets, Supabase Auth mail and buyer
  replies all land there. The script pre-confirms the email so provisioning
  doesn't depend on the mailbox, but recovery does.
- **It can't subscribe.** There is nothing to buy — it already holds the top
  tier — and the paid checkout routes answer 409 to an admin or complimentary
  member (`assertCanStartPaidMembership()`). `applyStripeSubscription` /
  `applyPaypalSubscription` skip any profile whose `subscription_status` is
  `grandfathered` (`COMPLIMENTARY_STATUS` in
  `src/services/subscriptionService.js`), so a stray provider event can't
  downgrade the grant either.
- **It is a shared admin credential.** It has the full admin panel: user data,
  refunds, listings moderation. Prefer a long random password in a password
  manager over a memorable one, and turn on MFA (Account → Security) once you're
  signed in. If the password is ever shared around, rotate it with
  `--reset-password`.
- **To change the store's public details** (logo, tagline, trust badges,
  shipping policy, ABN), sign in as the account and use **Account → Sole
  Trader** — those fields are not locked and are meant to be edited in the app.
