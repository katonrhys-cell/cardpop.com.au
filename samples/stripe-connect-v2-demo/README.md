# Stripe Connect v2 — sample integration

A self-contained demo of Stripe's **v2 Accounts API** for CardPop: connected-account
creation (`dashboard: 'full'`, Stripe as fees/losses collector), hosted onboarding via
v2 Account Links, products created on the connected account, a per-seller storefront
taking **direct charges with an application fee**, a **platform subscription billed to
the connected account** (`customer_account`) with a billing portal, and both webhook
styles (thin events for account changes, snapshot events for billing).

> ⚠️ **This is a sample, not CardPop production.** The live app pays sellers with
> Connect **Express** accounts + separate charges and transfers
> (`src/services/connectService.js`, `src/services/payoutService.js`). This demo is the
> opposite architecture and exists to evaluate v2 Accounts in test mode. Nothing in the
> production app imports anything from `samples/`.
>
> **Prerequisite:** Accounts v2 must be enabled for the platform account. CardPop's
> livemode platform currently rejects v2 creation with *"Accounts v2 is not enabled for
> your livemode merchant acct_1TUPfuDQ9zWKnSHa"* — see
> <https://docs.stripe.com/accounts-v2/use-accounts-as-customers>. Use **test mode**.

## Run it

```bash
# From the repo root (uses the repo's stripe + express dependencies):
STRIPE_SECRET_KEY=sk_test_... node samples/stripe-connect-v2-demo/server.mjs
# → http://localhost:4242
```

| Env var | Required | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | Platform **test** secret key (`sk_test_…`). The server exits with instructions if missing. |
| `SUBSCRIPTION_PRICE_ID` | for step 5 | A recurring Price on the **platform** account (Dashboard → Product catalogue → Add product → recurring). The Subscribe button explains this if unset. |
| `CONNECT_WEBHOOK_SECRET` | for webhooks | `whsec_…` printed by the thin-events `stripe listen` below. |
| `BILLING_WEBHOOK_SECRET` | for webhooks | `whsec_…` printed by the snapshot-events `stripe listen` below. |
| `DEMO_BASE_URL` / `PORT` | no | Defaults `http://localhost:4242` / `4242`. |
| `DEMO_ACCOUNT_COUNTRY` | no | Country for new accounts — defaults to `au` (Stripe's brief used `us`). |

The demo stores its user → account mapping in a git-ignored `.demo-data.json` beside the
server (stand-in for `profiles.stripe_connect_account_id` in the real DB).

## Webhooks

**Thin events** (v2 account/requirements changes) → `/webhooks/connect`:

```bash
stripe listen --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' \
  --forward-thin-to localhost:4242/webhooks/connect
```

**Snapshot events** (subscription lifecycle + checkout verification) → `/webhooks/billing`.
Storefront sales are **direct charges**, so their `checkout.session.completed` fires on
the *connected* account — forward those with `--forward-connect-to`:

```bash
stripe listen --events 'checkout.session.completed,customer.subscription.updated,customer.subscription.deleted,invoice.paid,payment_method.attached,payment_method.detached,customer.updated,customer.tax_id.created,customer.tax_id.updated,customer.tax_id.deleted,billing_portal.configuration.created,billing_portal.configuration.updated,billing_portal.session.created' \
  --forward-to localhost:4242/webhooks/billing \
  --forward-connect-to localhost:4242/webhooks/billing
```

Test a storefront purchase with card `4000 0000 0000 0077` (any future expiry, any
CVC) — it settles instantly to the connected account's available balance.

Export each printed `whsec_…` as the matching env var and restart the server.

For a deployed endpoint instead of the CLI: Dashboard → **Developers → Webhooks →
+ Add destination** → Events from **Connected accounts** → advanced options → Payload
style **Thin** → select the `v2.account[requirements].updated` and
`capability_status_updated` event types. Create a second (default, snapshot-style)
destination for the billing events.

## Notes that will save you time

- **One Stripe client** (`new Stripe(key)`) is used for every call; the SDK pins the
  API version itself (`2026-06-24.dahlia` generation) — never pass `apiVersion`.
- **No top-level `type`** when creating v2 accounts — express/standard/custom is v1
  vocabulary; v2 accounts are shaped by `configuration` + `dashboard` instead.
- In test mode the sample sends `configuration.merchant.simulate_accept_tos_obo: true`
  so payments work without a human completing onboarding; it is automatically omitted
  with a live key (real accounts must accept the ToS themselves).
- Connected-account-scoped calls (products, prices, checkout for storefront sales) pass
  `{ stripeAccount: accountId }` as request options — that's the `Stripe-Account` header.
- Subscription objects for v2 accounts expose the payer as **`customer_account`**
  (`acct_…`) — do not read `.customer`.
- Onboarding status is always read live from
  `v2.core.accounts.retrieve(id, { include: ['configuration.merchant', 'requirements'] })`,
  never cached.
- stripe-node ≥ v22 parses thin events with `parseEventNotification(...)` (older docs
  call it `parseThinEvent`); the full event is then fetched via
  `v2.core.events.retrieve(id)`.
- Storefront URLs use the raw `acct_…` id for brevity — swap in your own identifier
  (e.g. CardPop's `store_slug`) in anything real.
