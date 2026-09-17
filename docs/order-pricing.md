# Order pricing — what the buyer pays, what the seller gets, what CardPop keeps

Every line on a CardPop order, where it is computed, and who ends up with it.

## The lines

An order is priced in one place per path — `createSingleItemCheckout()`
(`src/services/checkoutService.js`) for a Buy Now / accepted-offer purchase, and
`priceCart()` (`src/services/cartService.js`) for a multi-item cart — and both
build the same ladder:

| Line | Source | Who gets it |
|---|---|---|
| Item price | `listings.price_aud`, or the agreed offer amount | Seller, less commission |
| Platform fee (commission %) | `fee_config` row for the seller's tier | CardPop |
| GST | `gst_rate_pct` on item + commission | CardPop (see the caveat below) |
| Shipping | `listings.shipping_cost_aud`, per seller | Seller, in full |
| Payment processing | `calculateProcessingFee()` | CardPop, to pay Stripe |

The buyer pays the sum. The seller is paid `item − commission + shipping`
(`sellerProceedsAud` in the session metadata, `seller_proceeds_aud` on the
order). No part of the GST or the processing fee reaches a seller.

## The processing fee

CardPop is the **merchant of record**: the buyer is charged on the platform
Stripe account and the seller is paid by a separate transfer
(`docs/stripe-connect.md`). Stripe's processing fee therefore comes out of
platform funds on every order. Until this line existed it was absorbed silently
by the commission, which meant small orders and higher-rate payment methods
completed at a loss.

### It is grossed up on purpose

Stripe charges its percentage on the amount actually captured — and that amount
*includes this fee*. A flat `rate × subtotal + fixed` therefore under-collects
by `rate × fee`. `processingFeeCents()` (`src/utils/processingFee.js`) solves

```
fee = rate × (subtotal + fee) + fixed
```

giving `fee = (rate × subtotal + fixed) / (1 − rate)`, rounded **up** to the
cent. `tests/backend/utils/processingFee.test.js` asserts the result covers
Stripe's actual cut at every order size from $1 to $5,000.

### Rates

Stored in `platform_settings`, editable at Admin → Commission Settings without a
deploy:

| Key | Default | Meaning |
|---|---|---|
| `processing_fee_enabled` | `true` | Off = the platform absorbs Stripe's fee out of commission, as before |
| `processing_fee_pct` | `1.9` | Percentage component |
| `processing_fee_fixed_aud` | `0.35` | Fixed component |

1.9% + $0.35 covers Stripe AU's domestic card rate (1.75% + $0.30, dropping to
1.65% + $0.30 on 1 October 2026) with a margin. **International cards are 3.5%**
and stay partly absorbed by the commission — deliberately, since charging every
domestic buyer an international-card rate costs more in conversion than the
minority of international cards costs in fees. If international volume grows,
raise `processing_fee_pct` rather than changing code.

A rate at or above 50% is clamped: the gross-up divisor explodes as the rate
approaches 100%, so a settings typo of `19` for `1.9` must not bill a buyer a
fortune.

### It is priced before discounts, deliberately

A welcome-offer or wallet coupon is applied to the session *after* the fee is
sized, so a discounted order collects slightly more fee than Stripe ends up
charging (≈2c per $10 discounted). That direction is the safe one: sizing the
fee on the post-discount total would under-collect whenever a coupon is applied
after the quote, and under-collecting is the exact failure this line exists to
prevent.

### GST is not added on top of it

The fee reimburses a Stripe fee that is itself GST-inclusive, so it sits
**outside** the GST base — charging 10% on top would bill the buyer tax on a
tax. It is also kept out of `platform_fee_aud` (which means commission + GST,
the figure admin revenue reporting and refund retention are computed from) and
lives in its own `orders.processing_fee_aud` column.

### Refunds retain it in full

Stripe does not return its processing fee when a payment is refunded. If
CardPop refunded the buyer's reimbursement of it, every refund would cost the
platform that fee on top of the goods coming back. `processRefund()`
(`src/services/refundService.js`) therefore retains **all** of
`processing_fee_aud` plus the usual `refund_fee_retention_pct` share of
commission + GST. Orders placed before the column existed carry 0 and behave
exactly as they did.

## Payment methods are pinned

`src/utils/checkoutPaymentMethods.js` pins `payment_method_types` to
**`['card', 'paypal']`** on both checkout paths. `card` covers Apple Pay, Google
Pay and saved cards — those are card payment methods wearing a wallet, not
separate types.

This exists because Afterpay costs roughly **6% + $0.30** through Stripe. On a
$100 order that is ~$6.30 against a processing fee sized for a card, so every
BNPL sale would lose money. Stripe Checkout has no "everything except X" option:
either you omit `payment_method_types` and the Dashboard decides (which is how
Afterpay came to be offered in the first place), or you pin a list. We pin one,
so nothing re-enables BNPL by a Dashboard toggle.

**Every pinned type must be active on the Stripe account** — pinning an inactive
one makes `sessions.create` throw, which takes checkout down. Hence the override:

| `STRIPE_PAYMENT_METHOD_TYPES` | Effect |
|---|---|
| unset | `card,paypal` (the default) |
| `card` | cards and card wallets only — use this if PayPal isn't active |
| `card,paypal,link` | add Link, once it is active on the account |
| `auto` | hand control back to the Dashboard's dynamic selection |

Set it in Vercel to correct the list without waiting for a deploy.

## The GST caveat

`gst_on_commission_only` is `false`, so GST is charged on the **full sale price**
(item + commission) and CardPop keeps all of it — the seller receives none of
it. Whether that money is CardPop's revenue or a liability owed to the ATO is a
tax question, not a code one, and it is the largest single number in most
orders. Nothing in this repo remits it. Confirm the treatment with an accountant
before reading platform revenue off the admin dashboard.

## Related files

| File | Role |
|---|---|
| `src/utils/processingFee.js` | The gross-up, and the rate clamp |
| `src/services/commissionService.js` | Settings lookup, commission + GST breakdown, `calculateProcessingFee()` |
| `src/services/checkoutService.js` | Single-item line items, metadata, seller proceeds |
| `src/services/cartService.js` | Cart line items and per-seller postage |
| `src/services/stripeWebhookService.js` | Amount-match guard, order row, payout |
| `src/services/refundService.js` | Fee retention on refunds |
| `src/utils/checkoutPaymentMethods.js` | The pinned method list |
