# PayPal at Marketplace Checkout — Design

Status: **proposal / awaiting decisions** · Author: audit pass 2026-07 · Scope: add PayPal as a buyer payment option at cart checkout, alongside the existing card (Stripe) flow.

## 1. Goal

Let a buyer pay for a marketplace cart with **PayPal** instead of a card. The money settles, an order is created, stock/listings update, the seller is paid, and confirmation emails/notifications go out — **exactly as the Stripe path does today**, so downstream code (orders admin, buyer protection, disputes, refunds) doesn't care which rail was used.

Non-goal (for v1): PayPal for the **membership subscription** — that already exists (`src/routes/subscription.js`, `paypalClient.js`) and is unchanged.

## 2. What already exists (reused, not rebuilt)

| Piece | File | Reuse |
|---|---|---|
| PayPal REST client (auth, webhook verify) | `src/utils/paypalClient.js` | Extend with Orders v2 calls |
| Server-authoritative cart pricing | `src/services/cartService.js` `priceCart()` | **Reused as-is** — single source of truth for amounts |
| Pending-order-then-confirm pattern | `src/routes/stripe.js` `create-cart-checkout` | Mirror for PayPal |
| Order fulfillment (claim listing, decrement stock, pay seller, notify, email) | `src/services/stripeWebhookService.js` `handleCartOrder` | **Refactor into a shared function** both rails call |
| Seller payout with wallet fallback | `src/services/payoutService.js` `payoutSeller()` | Wallet-credit branch is the PayPal payout mechanism |
| Payment method UI | `components/checkout/PaymentMethodSelector.jsx` | Add a PayPal option |
| Velocity / fraud check | `checkPurchaseVelocity` | Reused unchanged |

**Key realization:** `payoutSeller()` already credits a seller's CardPop wallet when they aren't on Stripe Connect. Since PayPal funds land in the *platform's* PayPal balance (not Stripe), the wallet-credit branch is exactly how sellers get paid for PayPal orders — no new payout infra needed for v1.

## 3. Integration model

**PayPal Standard Checkout (Orders v2) with the JS SDK "smart buttons".** This is PayPal's current recommended integration and mirrors the Stripe hosted flow:

1. Buyer picks **PayPal** on the checkout page → the PayPal button renders (JS SDK, loaded lazily).
2. Button click → frontend calls our **`POST /paypal/create-order`**. Backend re-prices the cart with `priceCart()` (never trusts the client), calls PayPal **Create Order**, writes a `pending` order row keyed on `paypal_order_id`, returns the PayPal order id.
3. PayPal shows its approval popup; buyer approves in their PayPal account (no card entry on our site).
4. On approval → frontend calls **`POST /paypal/capture-order`**. Backend calls PayPal **Capture Order**, verifies the captured amount equals the server-priced total, then runs the shared fulfillment.
5. Backup: a **`PAYMENT.CAPTURE.COMPLETED` webhook** re-runs fulfillment idempotently in case the browser dies between approve and capture.

Why buttons over redirect: better conversion, no full-page redirect, and it's the standard for Orders v2.

## 4. Flow (sequence)

```
Buyer                Frontend               Backend                    PayPal
  |  select PayPal      |                      |                          |
  |-------------------->| render SDK button    |                          |
  |  click button       |                      |                          |
  |                     |-- POST /paypal/create-order (items,shipping) --> |
  |                     |                      | priceCart() (authoritative)
  |                     |                      |-- Orders v2: Create ----->|
  |                     |                      |<-- order id --------------|
  |                     |                      | insert pending order       |
  |                     |<-- {paypalOrderId} --|  (key: paypal_order_id)     |
  |  approve in popup <----------------- PayPal approval UI -------------->|
  |                     |-- POST /paypal/capture-order (paypalOrderId) --->|
  |                     |                      |-- Orders v2: Capture ---->|
  |                     |                      |<-- capture (amount,id) ---|
  |                     |                      | verify amount == total     |
  |                     |                      | fulfillConfirmedOrder(...)  |
  |                     |<-- {status: paid} ---|  (claim/stock/payout/email) |
  |  see success page <-|                      |                          |
                                (webhook PAYMENT.CAPTURE.COMPLETED = backup)
```

## 5. Backend changes

### 5.1 Extend `paypalClient.js` (Orders v2)
Add: `createOrder({ amountCents, currency:'aud', referenceId, items?, shipping? })`, `captureOrder(paypalOrderId)`, `getOrder(id)`, `refundCapture(captureId, amountCents?)`. Same OAuth token helper already there.

### 5.2 New router `src/routes/paypal.js` (mounted like stripe, behind `authMiddleware` + `apiLimiter`)
- `POST /paypal/create-order` — re-price with `priceCart`, run `checkPurchaseVelocity`, Create Order for the **server** total, insert `pending` order (`payment_provider:'paypal'`, `paypal_order_id`). Mirrors `create-cart-checkout` lines 132–256.
- `POST /paypal/capture-order` — Capture, amount cross-check (±2¢), then fulfill. Compare-and-swap `pending → payment_confirmed` keyed on `paypal_order_id` (idempotency, same guard as the Stripe path).
- `POST /paypal/webhook` — verify via existing `verifyPaypalWebhook`, handle `PAYMENT.CAPTURE.COMPLETED` / `.DENIED` / `.REFUNDED`. Reuse the `stripe_webhook_events`-style dedup (add a `paypal_webhook_events` table or a shared `processed_webhook_events`).

### 5.3 Refactor fulfillment (the important structural change)
Extract the body of `handleCartOrder` (from the compare-and-swap onward: welcome/partner/wallet consumption, `claimListingSold`, `decrement_shop_stock`, `payoutSeller`, notifications, emails) into:

```
fulfillConfirmedOrder(order, { provider, stripe? })
```

- Stripe path calls it after its compare-and-swap; PayPal path calls it after capture.
- Payout branches on **provider + the seller's payout preference** (§5.5), not just provider.
- Everything else (double-sale guard, oversell notify, buyer/seller notifications, emails) is provider-agnostic and shared verbatim.

This refactor also *reduces* duplication in the current code and is independently valuable.

### 5.5 Seller payout — per-seller preference (DECIDED)
Shop items are platform-owned, so a PayPal payment for them simply lands in the **platform (admin) PayPal balance** — no payout step. For **seller listings** paid via PayPal, each seller chooses how they're paid:

- **Seller has a PayPal payout method** (email on file, verified) → pay their proceeds via the **PayPal Payouts API** (`POST /v1/payments/payouts`) to that email, after the platform captures the buyer's payment.
- **No PayPal on file** → **credit their CardPop wallet** (existing `payoutSeller` wallet branch); they withdraw later.

`payoutSeller` gains a `provider` arg and consults a new seller payout-preference:
```
payoutSeller(stripe, { sellerId, sellerProceeds, listingId, orderId, provider })
  provider==='stripe' → existing behaviour (Connect transfer, else wallet)
  provider==='paypal' → if seller.payout_paypal_email → PayPal Payouts
                        else → wallet credit
```
New `paypalClient.createPayout({ email, amountCents, note })`. Payout failures fall back to wallet-credit (never lose the seller's money), mirroring the Stripe fallback. Refund clawback reuses the wallet-clawback branch; a PayPal Payout that already went out is clawed back to wallet (negative) or flagged for admin if the payout is unreversible.

**Seller onboarding:** add a `payout_paypal_email` (+ `payout_method` enum: `wallet` | `paypal`) to the seller's profile/settings, entered in account settings. Sellers with neither Stripe Connect nor PayPal default to wallet.

### 5.4 `src/app.js`
The PayPal webhook does **not** need the raw-body exemption Stripe needs — `verifyPaypalWebhook` posts the parsed event to PayPal's verify API (same as the existing subscription webhook). No `express.raw` change.

## 6. Database migration

Add to `orders` (all nullable / defaulted, backward-compatible):
- `payment_provider text not null default 'stripe'` (existing rows = stripe)
- `paypal_order_id text unique` (the idempotency key, mirrors `stripe_session_id`)
- `paypal_capture_id text` (for refunds)

Unique index on `paypal_order_id` gives the same duplicate-insert protection as `stripe_session_id`. New `processed_webhook_events` (or `paypal_webhook_events`) for event dedup, mirroring `stripe_webhook_events`.

## 7. Frontend changes

- `PaymentMethodSelector.jsx`: add a **PayPal** radio option (enabled only when `VITE_PAYPAL_CLIENT_ID` is set, so it can ship dark).
- `pages/CheckoutPage.jsx`: when `paypal` is selected, lazy-load the PayPal JS SDK (`https://www.paypal.com/sdk/js?client-id=…&currency=AUD`) and render the buttons instead of the "Confirm & Pay" (Stripe) button. `createOrder`/`onApprove` call the two new endpoints. Reuse the existing success handling (`/checkout-success`) — or a PayPal variant that reads the order by `paypal_order_id`.
- New public env: `VITE_PAYPAL_CLIENT_ID` (client id is public by design). Server keeps `PAYPAL_CLIENT_SECRET`.

## 8. Discounts, promo codes, wallet

- **Promo / welcome / partner codes:** supported by computing the discount server-side (same validators) and creating the PayPal order for the **already-discounted** total (PayPal has no coupon object; we just charge the net amount and still record `discount_aud` + attribute the partner). 
- **Stripe-customer wallet balance as payment:** the current "use wallet balance" path is built on Stripe Customer Balance + Stripe coupons (`create-cart-checkout` lines 192–209). That's Stripe-specific. **Recommendation:** for v1, disable the "use wallet balance" toggle when PayPal is selected (card-only), and revisit once we unify wallets. (Note there are two wallet concepts in the codebase — Stripe Customer Balance for buyers, and `profiles.wallet_balance_aud` for seller payouts — worth consolidating later.)

## 9. Refunds

Extend the refund path (`refundService`) so a PayPal order refunds via `refundCapture(paypal_capture_id)` instead of a Stripe refund, chosen on `order.payment_provider`. Seller clawback reuses `reverseSellerPayout`'s wallet-clawback branch (PayPal orders always paid via wallet, so the Stripe-transfer-reversal branch is skipped).

## 10. Security & correctness

- Amounts **always** from `priceCart()` server-side; the capture amount is cross-checked against the server total before fulfillment (same ±2¢ guard as Stripe).
- Idempotency: unique `paypal_order_id` + compare-and-swap on status + webhook event dedup — identical guarantees to the Stripe path.
- Webhook signature verified via PayPal's verify API (`PAYPAL_WEBHOOK_ID`).
- Double-sale / oversell guards are in the shared fulfillment, so PayPal inherits them.

## 11. Testing

PayPal **Sandbox** (`PAYPAL_ENV=sandbox`) allows full end-to-end testing with fake buyer/seller accounts — **no real money**, unlike the current live Stripe setup. This means we can prove the whole flow (create → approve → capture → order → payout → refund) before switching `PAYPAL_ENV=live`. Backend unit tests mirror `stripe-webhook-idempotency.test.js` (capture idempotency, amount-mismatch rejection, dedup).

## 12. Rollout phases

1. **DB migration** (columns + dedup table) — safe, backward-compatible.
2. **Refactor** `handleCartOrder` → `fulfillConfirmedOrder` (no behavior change; full test run).
3. **Backend** PayPal Orders endpoints + webhook, behind config flags (ship dark).
4. **Frontend** button + selector, gated on `VITE_PAYPAL_CLIENT_ID`.
5. **Sandbox** end-to-end verification.
6. Flip to live.

## 13. Decisions (LOCKED — 2026-07)

1. **Seller payout:** per-seller preference. Shop items → **platform/admin PayPal** (no payout). Seller listings → **PayPal Payouts** to the seller's PayPal email if they have one on file, else **CardPop wallet** credit. Payout failure always falls back to wallet (never lose seller funds). See §5.5.
2. **Item scope:** **both** shop items and seller listings accept PayPal at launch (so the seller-payout mechanism in §5.5 must be built + sandbox-tested before go-live).
3. **Wallet-as-payment with PayPal:** **card-only for v1** — the "use wallet balance" toggle is hidden when PayPal is selected. Promo/welcome/partner codes still work (applied as an amount discount). Revisit after wallet consolidation.
4. **Follow-up (non-blocking):** consolidate the two "wallet" concepts (buyer Stripe Customer Balance vs seller `wallet_balance_aud`).

## 14. Extra build items from the locked decisions

- **Seller payout settings UI + schema:** `profiles.payout_paypal_email`, `profiles.payout_method` (`wallet` | `paypal`), edited in account settings; validated (basic email + optionally a PayPal-side check).
- **`paypalClient.createPayout()`** (PayPal Payouts API) + payout-failure → wallet fallback + refund/clawback handling for PayPal payouts.
- **Admin visibility:** show `payment_provider` + payout method/status on the order in the admin orders view, so you can see at a glance how each order was paid and how the seller was paid.
