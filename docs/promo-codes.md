# Promo codes (Admin → Promo Codes)

`/admin/promo-codes` (`pages/admin/PromoCodesAdminPage.jsx`) is where an admin
creates and manages checkout discount codes.

## What a code can do

| Setting | Meaning |
|---|---|
| **Code** | 4–30 letters/numbers/hyphens, stored upper-case. Type your own (`SAM-VIP`) or press **Generate** (`CP-XXXXXXXX`, no ambiguous 0/O/1/I/L). Fixed once the code has been used. |
| **Percentage off** | Any value from 0.01% to 100%. |
| **Applies to** | *CardPop Shop items only* (default) or *Whole cart*. On marketplace cards CardPop funds the discount itself — sellers are always paid in full — so set a **maximum discount** on whole-cart codes. |
| **Type** | **One-off** — one use, ever, by anyone. **Ongoing** — reusable, optionally capped at a total number of uses and/or **once per customer**. |
| **Starts / Expires** | Optional window. Outside it the code is refused at checkout. |
| **Minimum spend / Maximum discount** | Optional. Minimum spend is measured on the items the code applies to. |
| **Who it's for** | Name + email of the person you gave it to. Tick **Only this person can use it** to lock it to that CardPop login email. |
| **Label / Notes** | Free text for your own records. |
| **Active** | Toggle off to pause a code. A code that has been used can't be deleted, only deactivated (its history is kept). |

The list shows each code's status (active / scheduled / used up / expired /
deactivated), how many times it was used, the total discount given and when it
was last used. The history button lists every use: buyer, order, discount and
whether it completed.

## How checkout uses it

Codes go in the existing **Promo Code** box at checkout and are available to
signed-in buyers (guest checkout ignores promo codes, as before). Routing
(`src/routes/stripe.js`):

1. `POP-XXXX-XXXX` → personal welcome offer.
2. Otherwise a promo code with that text (`promo_codes`).
3. Otherwise a partner referral code (`partners`).

Promo and partner codes share a namespace — DB triggers stop the same code
existing in both tables.

The discount is a one-off Stripe **amount-off** coupon on the item subtotal
(never fees, GST, shipping or seller proceeds), and it never takes the total
below Stripe's 50¢ minimum. The order's `discount_aud` records it.

Every use is a `promo_code_redemptions` row:

- **reserved** when the Checkout Session is created — `reserve_promo_code()`
  locks the code row, so a one-off or capped code can't be spent by two
  checkouts at once. A reservation older than 24 h (Stripe's session lifetime)
  stops counting.
- **redeemed** by the Stripe webhook once payment completes (with `order_id`).
- **released** when the session expires, the session couldn't be created, or
  every line in the order turned out to be a double-sale and was refunded.

Only `redeemed` uses count towards the "Used" figures; `reserved` ones still
block a one-off code while that buyer is paying.

## Files

- Migration: `supabase/migrations/20261002131905_create_promo_codes.sql`
  (test: `tests/db/run-promo-code-migrations.sh`)
- Service: `src/services/promoCodeService.js`
- Admin API: `GET/POST /admin/promo-codes`, `PATCH/DELETE /admin/promo-codes/:id`,
  `GET /admin/promo-codes/:id/redemptions` (`src/routes/admin.js`, admin + MFA gated)
- Webhook: `promoRedemptionId` session metadata, handled in
  `src/services/stripeWebhookService.js`

The single-item "Buy now" modal (`/stripe/create-checkout`) still only accepts
welcome codes; promo codes apply in the cart checkout.
