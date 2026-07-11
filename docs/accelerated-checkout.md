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
Stripe's Embedded Checkout on our own page. Because the Checkout Session uses
`automatic_payment_methods: { enabled: true }` (`src/routes/stripe.js`), Stripe
presents **every method enabled on the account**, each shown only when the order
is eligible:

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
