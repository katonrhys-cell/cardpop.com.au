# Accelerated checkout & "Shop Pay"

This documents how CardPop offers fast, wallet-based checkout — and clears up a
common question: **can we add Shopify's "Shop Pay" / list on shop.app?**

## Short answer on Shop Pay / shop.app

**No — not on this stack, and not by adding a script.** `Shop Pay` and the
`shop.app` shopping app are Shopify's proprietary ecosystem:

- **Listing products in the Shop app** is exclusive to Shopify stores. There is
  no API to push a custom Stripe/Supabase catalogue into it.
- **The "Shop Pay" checkout button** is, as of Shopify's Spring '26 edition,
  only opening to non-Shopify merchants via **enterprise Commerce Components**
  contracts, or via the **Instagram / TikTok / Google Shopping** sales channels —
  neither of which is a drop-in for a custom React site.

CardPop runs on **Stripe + Supabase**, not Shopify, so true Shop Pay would mean
migrating the store onto Shopify or an enterprise deal. Instead we give buyers
the **functional equivalent** through Stripe.

## What we offer instead (and where it's controlled)

The embedded checkout (`components/checkout/EmbeddedStripeCheckout.jsx`) renders
Stripe's Embedded Checkout on our own page. The Checkout Session **pins**
`payment_method_types` (`src/utils/checkoutPaymentMethods.js`), so Stripe
presents exactly what is pinned — not everything enabled on the account:

| Method | What it is | Offered? |
|---|---|---|
| Card (Visa/MC/Amex) | Standard card entry | **Yes** — pinned |
| Apple Pay / Google Pay | Device wallets | **Yes** — they ride on `card` (domain must be verified for Apple Pay) |
| PayPal | — | **Yes** — pinned; must also be active in the Stripe Dashboard |
| **Link** | Stripe's saved-card, one-tap wallet | No — add `link` to `STRIPE_PAYMENT_METHOD_TYPES` once it's active in the Dashboard |
| **Afterpay/Clearpay** | Buy now, pay in 4 | No — ~6% + $0.30 sells an order at a loss (`docs/order-pricing.md`) |
| Zip | Buy now, pay later (AU) | No — same reason |

**Adding a method is now two steps, not one**: enable it in the Stripe Dashboard
*and* add it to the `STRIPE_PAYMENT_METHOD_TYPES` env var. Pinning a type that
isn't active on the account makes `sessions.create` throw and takes checkout
down, so make the Dashboard change first. Before adding a BNPL method, raise
`processing_fee_pct` to cover its rate or the sale loses money.

## Buy-now-pay-later messaging (code)

**Currently off.** Checkout pins its payment methods to card + PayPal
(`src/utils/checkoutPaymentMethods.js`) because Afterpay costs ~6% + $0.30
through Stripe — enough to sell an ordinary order at a loss against a card-rate
processing fee (`docs/order-pricing.md`). The instalment copy is therefore
disabled by default, since advertising "4 interest-free payments" for a method
the buyer won't find at checkout is worse than not advertising it.

The machinery remains, ready if BNPL is ever repriced or reinstated:

- Component: `components/BnplMessage.jsx` — renders nothing while disabled
- Config: `lib/payments.js`
  - `VITE_ENABLE_BNPL=true` brings the copy back site-wide.
  - `VITE_BNPL_PROVIDER` overrides the provider name (default `Afterpay`).
  - It renders only for amounts inside Afterpay's AU range ($1–$2000), matching
    when Stripe actually offers the option.

Keep this in sync with checkout: turn the copy back on **only** alongside adding
the method to `STRIPE_PAYMENT_METHOD_TYPES`, or we advertise an option buyers
can't pick.

## Google Pay brand guidelines

Google publishes brand guidelines for how Google Pay may be shown
(developers.google.com/pay/api/web/guides/brand-guidelines). Three different
things on CardPop are covered by them:

1. **The actual "Buy with Google Pay" button** — rendered by Stripe itself
   inside `EmbeddedStripeCheckout.jsx`'s iframe when Google Pay is enabled in
   the Stripe Dashboard (see the table above). Stripe is a certified Google
   Pay processor and draws Google's own button asset there, so this is
   already fully compliant with no code on our side to maintain.
2. **The small "we accept…" trust row** — `GooglePayMark` in
   `PaymentMarks.jsx` (rendered by `PaymentMethodSelector.jsx`), shown before
   the buyer ever reaches Stripe. This is now Google's own vector asset end to
   end — the four-color "G" *and* the "Pay" wordmark as outlines, so nothing
   is typeset by us and there is no longer a Product Sans substitution gap.
   The artwork comes from the same Google Pay mark Stripe renders in its
   Payment Element; we drop only the mark's white pill container and #3C4043
   outline so it sits in the same badge chrome as the other logos. The badge
   gives it clear space well past the required half-the-mark's-height on
   every side.

3. **Confirmation page and receipt labeling.** The guidelines' "Put it all
   together" section asks that confirmation pages and email receipts
   *indicate when the buyer paid with Google Pay specifically*, not just
   "paid successfully." Implemented: `stripeWebhookService.js` resolves the
   wallet actually used (`resolveWalletType` — Stripe represents Google
   Pay/Apple Pay as `payment_method.type === 'card'` with `card.wallet.type`
   set, there's no separate `'google_pay'` method type) and stores it on
   `orders.payment_wallet_type` (migration
   `20260728111312_orders_payment_wallet_type.sql`, nullable, with a
   missing-column fallback for the deploy/migration race — same pattern as
   `gst_included_aud`). `/stripe/session/:id` also resolves it live from
   Stripe (`payment_intent.payment_method` expand) as `walletType` in its
   response, independent of whether the column has landed yet.
   `CheckoutSuccessPage.jsx` shows the `GooglePayMark` next to "Paid with"
   when `walletType === 'google_pay'`; `orderConfirmedEmail` adds a plain-text
   "Paid with Google Pay" line (no embedded logo — most mail clients block
   remote/inline images by default, so an image there would often just be a
   broken box).

## Possible follow-up: one-tap Express Checkout button

A Shop-Pay-style **express button on the cart / product page** (tap Apple Pay /
Google Pay / Link and pay without the full form) is possible with Stripe's
**Express Checkout Element**, but it is a larger change than the messaging above:
it needs a separate **PaymentIntent** flow, a new `payment_intent.succeeded`
webhook handler to create the order (today only `checkout.session.completed` is
handled), and wallet-provided address handling. Because it's money-path code, it
should be built and verified end-to-end in **Stripe test mode** with real wallet
test flows before shipping — it was intentionally left out of the display-only
messaging work.
