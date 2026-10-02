# Shop pre-orders

Sell a shop product before the stock arrives. A pre-order is bought and paid for
exactly like any other shop product (same cart, same Stripe checkout, same
pricing, shipping and GST). The only differences are the **Pre-order** label and
the **estimated dispatch** shown everywhere the product or the order appears.

## Setting one up (Admin → Products)

1. Open the product and set **Status** to **Pre-order**.
2. Fill in **Estimated dispatch**. It is free text, such as "Ships in 4–6 weeks"
   or "Expected mid-November". The preset buttons fill in common ones. It is
   required, and the database refuses a pre-order without one
   (`shop_products_preorder_eta_required`). Maximum 120 characters.
Pre-orders are **unlimited**. Stock is ignored while a product is on
pre-order: it is never shown as sold out, the cart doesn't cap quantities, and
paid pre-orders don't decrement `stock_quantity`. Keep an eye on Order
Management's **Pre-orders awaiting stock** filter to see how many you've sold.

When the stock arrives, set **Stock Quantity** to what you have left after
filling the pre-orders, and switch the status to **Active**. Orders already
placed keep their pre-order label.

## Palms Off Gaming

Migration `20261002023756_palms_off_preorder_7_10_days.sql` put the Palms Off
Gaming range on pre-order with the estimate "Ships in 7–10 days". It switched
every priced `coming_soon` line to `preorder` and gave every Palms Off line
(archived ones too) that estimate unless one was already set. Lines that were
`active`, `draft` or `archived` kept their status. To change the estimate for
one product, edit it in Admin → Products.

## Magnetic Metal Slab Case (35pt)

Migration `20261002130410_metal_slab_case_preorder.sql` adds the CardPop
Magnetic Metal Slab Case as a pre-order in eight colours (Black, Silver, Gold,
Red, Blue, Orange, Purple, Green). Each colour is its own product
(`CP-METAL-SLAB-35PT-<code>`), linked by `family_sku = 'CP-METAL-SLAB-35PT'`,
in **Graded Card Protectors** at $14.95 (RRP $19.95), estimate "Ships in 2–3
weeks". Page: `/shop/graded-card-protectors/magnetic-metal-slab-case-35pt`.

The photos are studio renders served from `public/images/shop/metal-slab-case/`,
drawn by `scripts/render-metal-slab-images.mjs` (re-run it to change a colour
or add one; pass `CHROMIUM_PATH` if Playwright's bundled browser isn't
installed). Replace them with real photographs in Admin → Products once stock
arrives. A colour the supplier doesn't actually stock should be archived there.

## What the buyer sees

| Where | What |
|---|---|
| Shop grids | An outlined "Pre-order" ribbon, the estimate under the price, and a **Pre-order** button (never "Sold out") |
| Product page | Pre-order badge, a callout with the estimate, and a **Pre-order now** button |
| Shop filters | A separate **Pre-order** option under Availability, so "In stock" means ships now |
| Cart drawer | The estimate under the item |
| Checkout summary | The estimate on each pre-order line, plus a note that pre-orders are paid now and dispatched when stock arrives |
| Stripe Checkout | The line is named "<product> (Pre-order — <estimate>)" |
| Receipt email | The estimate on the line, plus the same note |
| Account → Orders | The estimate on each pre-order line until the order ships |

Search engines get `availability: PreOrder` in the product's structured data.

## What admins see

- **Order alert** (email and bell): the subject reads "New pre-order received"
  and a Pre-order row lists each pre-ordered item and its estimate, so it isn't
  packed with the in-stock part of the order.
- **Admin → Order Management**: a Pre-order badge on those orders (hover for the
  estimates), the estimate on each line in the order detail, and a
  **Pre-orders awaiting stock** filter (paid, not yet shipped).

Ship as normal with **Mark as Shipped**. The buyer gets the tracking email.

## How it works

- `shop_products.status = 'preorder'` plus `shop_products.preorder_eta`
  (migration `20261002000345_shop_products_preorder_status.sql`), publicly readable like `active`.
- `PURCHASABLE_SHOP_STATUSES` in `utils/shopStock.js` (`active`, `preorder`)
  is the one list both the storefront and `src/services/cartService.js` use to
  decide what can be bought. `coming_soon` stays look-only.
- Unlimited: `cartService` skips its stock checks for pre-orders, the webhook
  (`handleCartOrder` in `stripeWebhookService.js`) skips the stock decrement
  for lines stamped `preorder`, and `isSoldOut()` / `hasUnlimitedStock()` in
  `utils/shopStock.js` keep the storefront and cart from capping them.
- At checkout `cartService` stamps `preorder: true` and `preorder_eta` onto
  the order line in `orders.order_items`. Everything order-side reads that
  snapshot, so changing the estimate later (or flipping the product to active)
  doesn't rewrite what an existing buyer was told.

## Things to decide outside the code

- **Mixed orders.** An order can hold in-stock and pre-order items. Shipping is
  charged once per order, so the code does not split it. Whether you hold the
  whole order or ship the in-stock part first is your call per order.
- **Can't fulfil.** The checkout and receipt tell buyers a pre-order that can't
  be supplied is refunded in full. Use the normal refund flow in Order
  Management. Under Australian Consumer Law a long delay past the estimate
  also entitles the buyer to cancel, so update the estimate if it slips.

## Testing the migration

```bash
PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-preorder-migration.sh
```
