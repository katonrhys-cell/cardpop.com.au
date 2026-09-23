# Finance & Tax (admin)

`/admin/finance` (Admin → Finance & Tax) turns orders + wholesale costs into
management accounts laid out with BAS labels, and exports CSVs for the
accountant. All arithmetic is in `utils/finance.js` (pure, unit-tested in
`tests/frontend/finance.test.js`); the page only fetches rows and renders.

## What it shows

| Block | Source | Notes |
|---|---|---|
| **Shop P&L** | `orders.order_items` lines with `type = 'shop'` on paid orders | Sales inc/ex GST, GST on sales, shipping, cost of goods sold, gross profit and margin, settled refunds |
| **Marketplace fees** | `platform_fee_aud`, `processing_fee_aud`, `platform_gst_aud`, `seller_gst_aud`, `seller_proceeds_aud` | CardPop's fee revenue ex GST; seller GST withheld and remitted is shown separately because it is not CardPop's revenue |
| **BAS summary** | the two above | G1 total sales, 1A GST on sales, 1B GST credits (estimate), net GST, and the seller GST remitted on their behalf |
| **Stock on hand** | `shop_products.stock_quantity` × `shop_product_costs` | Value at cost ex GST, at retail, potential gross profit, products with stock but no cost |
| **Shop sales by line** | one row per product per paid order | Exportable as CSV |

Periods: this/last **Australian financial year** (1 July → 30 June), the
current and previous **BAS quarter** (Q1 = Jul–Sep), or all time.

## Cost of goods sold

At checkout `src/services/cartService.js` snapshots the wholesale cost
(`shop_product_costs.wholesale_ex_gst_aud` / `_inc_gst_aud`) onto each shop
order line as `unit_cost_ex_gst_aud` / `unit_cost_inc_gst_aud`, so COGS
reflects the cost **at the time of sale** even if the supplier price changes
later. Lines from before this existed fall back to the current cost row; the
page says how many lines use a fallback (`costSource: current`) or have no
cost at all (`missing`). The snapshot is best-effort: if the cost table is
unreachable the checkout still completes and the line simply carries no cost.

## GST treatment (what the figures assume)

- Every selling price is GST-inclusive; GST = price × 1/11 at 10%
  (`gst_rate_pct` in `platform_settings` sets the rate for new orders; the
  page uses the per-line `gst_aud` recorded on each order).
- Shop goods and shipping are CardPop's taxable supplies → **G1 / 1A**.
- Commission and the processing fee are CardPop's taxable supplies → **G1 /
  1A**; the card itself is the *seller's* supply and is not in CardPop's G1.
- CardPop withholds `seller_gst_aud` from every seller's payout and remits it
  with no GST-registration test (a deliberately conservative decision, see
  `docs/order-pricing.md`). It is shown on its own line, not inside 1A.
- **1B is an estimate**: it is the GST inside the wholesale cost of goods
  *sold* in the period. The credit legally arises when stock is *purchased*
  (on the supplier's tax invoice), which this site does not record. Use the
  supplier invoices for the actual 1B figure; use this number to sanity-check
  margin.

These are management figures, not a lodgement. Confirm the treatment with an
accountant — in particular the seller-GST remittance position.

## Exports

- **Sales CSV**: one row per shop line — date, order ref, product, qty, sale
  inc/ex GST, GST, unit cost, COGS, GST credit on COGS, gross profit, margin,
  cost source.
- **Stock CSV**: every product with qty on hand, unit cost, value at cost and
  at retail.

Both are plain CSV for Excel/Xero/MYOB import.
