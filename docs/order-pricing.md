# Order pricing — what the buyer pays, what the seller gets, what CardPop keeps

Every line on a CardPop order, where it is computed, and who ends up with it.

## The lines

An order is priced in one place per path — `createSingleItemCheckout()`
(`src/services/checkoutService.js`) for a Buy Now / accepted-offer purchase, and
`priceCart()` (`src/services/cartService.js`) for a multi-item cart — and both
build the same ladder:

| Line | Source | Who gets it |
|---|---|---|
| Item price (GST-inclusive) | `listings.price_aud`, or the agreed offer amount | Seller, less commission and GST |
| Platform fee (commission %) | `fee_config` row for the seller's tier | CardPop |
| Shipping | `listings.shipping_cost_aud`, per seller | Seller, less the GST inside it |
| Payment processing | `calculateProcessingFee()` | CardPop, to pay Stripe |

**There is no GST line.** Every price above is GST-inclusive, as Australian
consumer prices must be, so nothing is added to the buyer's bill — the checkout
states "Includes GST of $X" instead of charging it.

The buyer pays the sum. The seller is paid
`item − commission − their GST + shipping` (`sellerProceedsAud` in the session
metadata, `seller_proceeds_aud` on the order). No part of the processing fee
reaches a seller.

### Worked example — a $101.17 card with $6.00 postage

| | |
|---|---|
| Item (incl. GST) | $101.17 |
| Platform fee (3%) | $3.04 |
| Shipping | $6.00 |
| Payment processing | $2.50 |
| **Buyer pays** | **$112.71** |
| — GST inside that total | $10.52 (stated, not charged) |
| Seller receives | $94.39 |
| CardPop gross | $18.32 |
| …less Stripe's cut | $16.05 |
| …less all GST remitted | **$5.53** |

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

### Refunds return it (full refunds by default)

Stripe does not return its processing fee when a payment is refunded, so every
refund costs the platform that fee. The Buyer Protection policy
(`utils/buyerProtectionPolicy.js`, decided 2026-10-03) still refunds it: an
approved claim is a **full refund** — item, postage, service fee and
processing fee — because change of mind is never an eligible reason on a
marketplace card, so there is no no-fault case left to keep a fee on. The
seller's payout is reversed (`reverseSellerPayout`); the Stripe fee is CardPop's
cost of the claim.

`computeRefundAmounts()` in `utils/refundAmounts.js` (shared by the request
quote in `routes/refunds.js`, admin approval in `routes/admin.js`,
`processRefund()` and Account → Orders) keeps the retention machinery behind two
platform settings for the day the policy needs tightening:
`refund_fee_retention_pct` (share of `platform_fee_aud` kept, default **0**) and
`refund_retain_processing_fee` (default **false**). CardPop Shop orders are
always refunded in full whatever those say — the shop return policy registered
in Google Merchant Center promises no restocking fee
(`utils/shopReturnPolicy.js`) — and a mixed cart applies any retention to the
marketplace share only.

The **claim window** is enforced by the same module on both ends:
`refundWindow(order)` drives the Request Refund button and is checked again in
`POST /refunds/request` (409 `REFUND_WINDOW_NOT_OPEN` / `REFUND_WINDOW_CLOSED`).
Marketplace: 7 days from delivery (`delivered_at`, else `shipped_at` + 10 days),
a not-received claim after 7 days unposted, and a hard cap of 45 days from
purchase. Shop: 14 days from delivery.

## Australia only

CardPop sells and ships within Australia only, enforced in three places:

1. **`checkAustralianAddress()`** (`src/utils/addressValidation.js`) — an AU
   state and a four-digit postcode, and no explicitly non-Australian country.
   Runs on both checkout paths *before* the Amazon Location geocode, because
   that check **fails open** when `AWS_LOCATION_API_KEY` isn't configured and
   would otherwise wave an overseas address straight through. It also makes a
   delivery address mandatory on cart checkout, which the fail-open geocode did
   not.
2. **`shipping_address_collection: { allowed_countries: ['AU'] }`** on the
   single-item Checkout Session. That path is reached from the Buy Now modal,
   which collects no address at all, so Stripe collects one and the country
   picker offers only Australia.
3. **`cardCountryPolicy.js`, enforced in the webhook.** Neither of the above
   stops an overseas *card* paying for delivery to an Australian address or a
   forwarder. A card's country comes from its BIN, which Stripe only resolves
   when the payment is authorised — and Checkout captures on completion — so
   this cannot be blocked at checkout. Instead the webhook refuses to fulfil:
   no order row, no listing claimed, no seller paid, and the payment is
   refunded in full. `ALLOWED_CARD_COUNTRIES` (default `AU`) widens the list
   without a deploy; `any` switches the check off.

   A method that reports **no** country is allowed through. Stripe populates a
   country for cards and card wallets but not always for PayPal, and failing
   closed there would refund good domestic payments over a field Stripe never
   filled in.

4. **A Stripe Radar rule — the cheaper front line.** Stripe does **not** return
   its processing fee on a refund, so every blocked payment costs CardPop that
   fee (~$2 on a $100 order). A Radar rule — *Block if `:card_country:` !=
   `AU`* — declines before capture and costs nothing. It is a dashboard step,
   and worth doing; point 3 is the backstop that holds whether or not it
   exists.

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

## GST

Every price on CardPop is **GST-inclusive**. The tax is the component inside the
price — `amount × rate / (100 + rate)`, i.e. 1/11 at 10% — never an amount added
on top. The shop catalogue has always priced this way; marketplace listings now
match it.

`calculateGst()` splits the included GST by **who supplied what**:

| Supply | GST on it | Where it comes from |
|---|---|---|
| The card, and the seller's postage | `seller_gst_aud` | **Deducted from the seller's payout.** CardPop remits it to the ATO on their behalf |
| Commission (counted twice — it is charged to the buyer as a line *and* deducted from the seller) and the processing fee | `platform_gst_aud` | Inside fees CardPop already holds |

Both are recorded on the order, and `gst_included_aud` is their sum — the total
GST CardPop is responsible for remitting on that order. `gst_aud` means GST
*added on top* and is now always 0; historical rows may carry a real figure.

### It applies to every seller and every transaction

There is no GST-registration test and no exemption path. A seller under the
$75,000 turnover threshold is not required to be registered and would not
ordinarily charge GST on their own sales, so for those sellers this withholding
is conservative rather than strictly required — a deliberate business decision,
taken so nothing is ever owed to the ATO after the fact. It is a tax position,
not a code one: **confirm it with an accountant**, and be ready to explain it to
sellers, because 1/11 of every sale is a visible deduction from their money.

Sellers are told before they list (`components/SellerPayoutEstimate.jsx` prices
the deduction live under the asking-price field) and again when a sale completes
(the "you made a sale" email itemises it).

### Changing the rate

`gst_enabled` switches the whole thing off (both shares become 0);
`gst_rate_pct` sets the rate. Both live in `platform_settings`.
`gst_on_commission_only` is retired — with inclusive pricing there is no base to
choose — and nothing reads it.

## Related files

| File | Role |
|---|---|
| `src/utils/processingFee.js` | The gross-up, and the rate clamp |
| `src/services/commissionService.js` | Settings lookup, commission breakdown, `calculateGst()`, `calculateProcessingFee()` |
| `src/utils/addressValidation.js` | The Australia-only address gate, and the Amazon Location geocode |
| `src/utils/cardCountryPolicy.js` | Which card countries may pay |
| `components/SellerPayoutEstimate.jsx` | Live "you'll receive $X" under the asking price |
| `src/services/checkoutService.js` | Single-item line items, metadata, seller proceeds |
| `src/services/cartService.js` | Cart line items and per-seller postage |
| `src/services/stripeWebhookService.js` | Amount-match guard, order row, payout |
| `src/services/refundService.js` | Fee retention on refunds |
| `src/utils/checkoutPaymentMethods.js` | The pinned method list |
