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
Stripe's Embedded Checkout on our own page. Because the Checkout Session omits
`payment_method_types` (`src/routes/stripe.js`), Stripe presents **every method
enabled on the account**, each shown only when the order is eligible:

| Method | What it is | Turned on where |
|---|---|---|
| Card (Visa/MC/Amex) | Standard card entry | Stripe Dashboard → Payments |
| **Link** | Stripe's saved-card, one-tap wallet — the Stripe-native equivalent of Shop Pay | Stripe Dashboard → Payments → Link |
| Apple Pay / Google Pay | Device wallets | Stripe Dashboard (domain must be verified for Apple Pay) |
| PayPal | — | Stripe Dashboard → Payments |
| **Afterpay/Clearpay** | Buy now, pay in 4 | Stripe Dashboard → Payments → Afterpay |
| Zip | Buy now, pay later (AU) | Stripe Dashboard → Payments → Zip *(optional)* |

**Enabling any of these is a Stripe Dashboard toggle, not a code change** — the
app already asks Stripe to surface whatever is enabled.

## Buy-now-pay-later messaging (code)

Professional retailers advertise instalments *before* checkout. CardPop shows an
`or 4 interest-free payments of $X.XX with Afterpay` line on product cards, the
cart drawer, and the checkout summary.

- Component: `components/BnplMessage.jsx`
- Config: `lib/payments.js`
  - `VITE_ENABLE_BNPL=false` hides the copy site-wide (e.g. if Afterpay is
    switched off in Stripe).
  - `VITE_BNPL_PROVIDER` overrides the provider name (default `Afterpay`).
  - It renders only for amounts inside Afterpay's AU range ($1–$2000), matching
    when Stripe actually offers the option.

Keep this in sync with the Stripe Dashboard: if Afterpay is disabled in Stripe,
set `VITE_ENABLE_BNPL=false` so we don't advertise an option buyers can't pick.

## Google Pay brand guidelines

Google publishes brand guidelines for how Google Pay may be shown
(developers.google.com/pay/api/web/guides/brand-guidelines). Two different
things on CardPop are covered by them:

1. **The actual "Buy with Google Pay" button** — rendered by Stripe itself
   inside `EmbeddedStripeCheckout.jsx`'s iframe when Google Pay is enabled in
   the Stripe Dashboard (see the table above). Stripe is a certified Google
   Pay processor and draws Google's own button asset there, so this is
   already fully compliant with no code on our side to maintain.
2. **The small "we accept…" trust row** — `GooglePayMark` in
   `PaymentMethodSelector.jsx`, shown before the buyer ever reaches Stripe.
   This is a hand-built recreation, not Google's literal provided asset: the
   letter colors and full "Google Pay" wording match the guidelines exactly,
   but the guidelines call for using Google's own SVG rather than a
   recreation. Swapping in the real file needs a one-time manual download
   from the brand guidelines page (gated behind a click-through agreement) —
   see the comment above `GooglePayMark` for exactly what to replace.

**Not yet built — a real follow-up, not just decoration:** the guidelines'
"Put it all together" section also asks that confirmation pages and email
receipts *indicate when the buyer paid with Google Pay specifically* (with
the mark), not just "paid successfully." CardPop doesn't currently capture
which wallet was used — Stripe represents Google Pay/Apple Pay payments as
`payment_method.type === 'card'` with `card.wallet.type` set to
`google_pay`/`apple_pay`, so surfacing this needs: expanding the payment
method on `checkout.session.completed`, a new nullable column on `orders`
(migration), passing it through `/stripe/session/:id`, and a small
conditional block in `CheckoutSuccessPage.jsx` and the `sendOrderConfirmed`
email template. Left out here deliberately since it touches the webhook /
schema / email pipeline — flagging it as a scoped, low-risk next step rather
than doing it silently.

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
