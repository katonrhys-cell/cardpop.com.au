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
3. Set **Pre-order Quantity** (the stock field) to how many you can supply,
   usually what you've ordered from the supplier. Every sale counts it down. At
   0 the product shows **Sold out** with the usual enquiry button, so you can
   never take more pre-orders than you can fill.

When the stock arrives, switch the status to **Active**. Whatever quantity is
left becomes ordinary stock. Orders already placed keep their pre-order label.

## What the buyer sees

| Where | What |
|---|---|
| Shop grids | An outlined "Pre-order" ribbon, the estimate under the price, and a **Pre-order** button |
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
