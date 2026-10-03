# Google Customer Reviews

Merchant Center account **CardPop Australia — 5819848586** (Merchant Center →
Growth → Customer Reviews → Set up integration). Code: `lib/googleCustomerReviews.js`.

## Opt-in (required)

`pages/CheckoutSuccessPage.jsx` calls `renderSurveyOptIn()` once payment is
confirmed. Google then shows a dialog asking the buyer whether it may email
them a survey after delivery.

| Google field | Value |
|---|---|
| `merchant_id` | `5819848586` |
| `order_id` | Stripe Checkout Session id (unique per purchase) |
| `email` | `customer_details.email` from the session |
| `delivery_country` | the session's shipping country, falling back to `AU` (checkout is Australia-only) |
| `estimated_delivery_date` | today + **5 business days**, matching the page's "3 – 5 Business Days" (`GCR_DELIVERY_BUSINESS_DAYS`) |
| `products` (optional) | `[{ gtin }]` for the shop products on the order that have a valid barcode (`GET /stripe/session/:id` → `gtins`); omitted for marketplace cards (no GTIN) — see `docs/shop-product-reviews.md` |
| `opt_in_style` (optional) | `CENTER_DIALOG` (Google's default, set explicitly — the corners hold toasts and the badge) |
| language (`window.___gcfg.lang`) | `en-AU`, set before `platform.js` loads |

`delivery_country` must be ISO 3166-1 alpha-2 and never `ZZ` — `normaliseDeliveryCountry()` falls back to `AU` for anything else. An email that isn't `name@domain.tld`-shaped skips the opt-in rather than sending Google a value it rejects.

**Pre-orders are skipped.** `GET /stripe/session/:id` returns `hasPreorder`
(a line named `… (Pre-order — <eta>)` by `cartService`); a pre-order ships weeks
out, so a survey timed to 5 business days would arrive before the parcel.

Google's checklist items, as they apply here:
- Cart and checkout on the same domain — yes (`cardpop.com.au`; Stripe-hosted
  payment returns to `/checkout-success` on our domain).
- Confirmation page on our own domain — yes.
- `<!DOCTYPE html>` as the very first bytes of every page, with nothing (not even
  a blank line) before it — `index.html` (served for every SPA route) and
  `api/prerender.js`. `index.html` used to open with a blank line; that was removed
  and `tests/frontend/indexDoctype.test.js` now guards it.
- HTTPS only — yes. Every card checkout (cart, embedded, buy-now/offer) returns
  to `/checkout-success`; nothing covers the opt-in dialog there (the badge is
  not started on that page).

## Badge (optional)

`components/GoogleReviewsBadgeLoader.jsx` (mounted in `App.jsx`) loads
`merchantwidget.js` on idle on the first eligible page of a visit, at
`LEFT_BOTTOM` (sonner toasts own bottom-right), region `AU`. It is never started
from checkout, sign-in or admin (`isBadgeEligiblePath`). Until CardPop has
enough ratings Google shows "no rating available" — expected.

## CSP / Trusted Types

Google's snippets are static `<script>` tags, which `strict-dynamic` blocks, so
both are injected from JS. `apis.google.com` was added to `script-src` and
`frame-src` in `vercel.json` and to the Trusted Types allowlist in
`lib/trustedTypesPolicy.js` (`www.gstatic.com` / `www.google.com` were already
there). If the dialog or badge doesn't appear, check the browser console for a
CSP or Trusted Types violation naming a new Google host and add it to all three.

Nothing loads off a production build or on localhost.

## Verifying

1. Deploy, place a real (or Stripe test-mode on a preview) order, land on
   `/checkout-success` → the Google opt-in dialog should appear.
2. Browse any public page → the badge appears bottom-left after a few seconds.
3. Merchant Center → Customer Reviews shows the integration as detected (can
   take a few days).
