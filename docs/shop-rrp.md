# Shop RRP (recommended retail price)

`shop_products.retail_price_aud` holds the manufacturer's RRP for a shop
product; `price_aud` stays the selling price. The shop shows the RRP
struck-through when it is above the selling price, and as "RRP $X" on a
product that isn't priced yet.

## Sale prices

`sale_price_aud` (on `shop_products` and `shop_product_variants`,
migration `20260926004139_shop_sale_price.sql`) puts an item on sale. It only
counts when it is above $0 and **below** the regular price (`price_aud`); then
the shop shows a **SALE** badge (with % off), the sale price in red, and the
higher of the RRP / regular price struck through — and checkout charges the
sale price. Clear it (Admin → Products → edit → **End sale**) and the item goes
back to its regular price.

- A colour variant with its own price uses its own sale price; a variant that
  inherits the product price also inherits the product's sale price, so one
  product-level sale covers every colour.
- The rule lives in one place, `utils/shopPricing.js` (`shopPriceInfo`,
  `shopSellingPrice`), used by the storefront, the admin list and margin,
  prerendered SEO data, and the server cart (`src/services/cartService.js`)
  — so the displayed price and the Stripe charge can't drift apart.
- The admin form refuses a sale price at or above the regular price: a "sale"
  with no genuine saving is misleading pricing under the Australian Consumer
  Law. The struck-through "was" price is only ever the real RRP or regular
  price.

Migration: `supabase/migrations/20260922095027_shop_products_retail_price.sql`
(idempotent — the column already existed in production outside migration
control; this brings it into the repo).

## Setting RRPs

Two paths, both admin-only:

1. **Admin → Products → edit** has an RRP field and a **Use RRP as price**
   button, for one product at a time.
2. **Bulk, from a CSV** — `data/shop-rrp.csv` is the committed template:
   one row per SKU (`sku,title,rrp_aud`), RRP left blank until known. Fill
   in the `rrp_aud` column, then run the script.

```bash
# Dry run (default): prints the plan, writes nothing
SUPABASE_URL=https://vrfsaazuqjxotnieqlkd.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=… \
node scripts/apply-shop-rrp.mjs

# Set RRP only
node scripts/apply-shop-rrp.mjs --apply

# Sell at RRP: RRP → retail_price_aud AND price_aud
node scripts/apply-shop-rrp.mjs --set-price --apply

# Sell at RRP but keep any price already set by hand
node scripts/apply-shop-rrp.mjs --set-price --only-unpriced --apply
```

Rules the script follows:

- Products are matched **by SKU** (`shop_products.sku`), case-insensitively.
  Every product has one: wholesale lines carry the brand SKU, CardPop house
  products carry `CP-<SLUG>` (backfilled and enforced by
  `supabase/migrations/*_shop_products_sku_required.sql`).
  A SKU with no product is reported, never inserted.
- Blank `rrp_aud` cells are skipped, so the template can be filled in a few
  rows at a time.
- `status` is never changed. A `$0` draft that gains a price stays a draft
  until switched to active in Admin → Products, so nothing goes on sale by
  accident.
- Re-running is idempotent — rows already at the CSV values are reported as
  unchanged.
- Titles in the CSV are for humans only; the database title is authoritative.

The Palms Off Gaming rows (59 SKUs) were seeded as `$0` drafts with no RRP.
Their RRPs are not in the repo or the database — take them from the brand's
price list and enter them in the CSV.

## Source: Palms Off Gaming order form (September 2026)

RRPs in `data/shop-rrp.csv` come from the MSRP column of the Palms Off
Gaming wholesale order form. Two mappings are not literal SKU matches:

- **Top Loaders** — the form calls these *Card Loaders* (`CL-…`); the shop's
  `TL-…` lines are the same products (same photo folder), so
  `TL-35/55/75/100/130/180PT` take `CL-…` MSRPs, `TL-PACK` takes `BPL-10`,
  `MF-TL-35PT` takes `MF-CL-35PT` and `MF-TL-PACK` takes `MF-BPL`. The
  shop's own `CL-35/100/180PT` lines duplicated the matching `TL-…` lines
  and were archived.
- **Mag Lock cases** — sold to trade as 25/20pc display cartons; the RRP
  used is the per-unit MSRP the form notes.

Retired (archived in `shop_products`, removed from `data/palmsOffCatalogue.js`
and this CSV): `CL-35PT` / `CL-100PT` / `CL-180PT`, which duplicated the
matching `TL-…` lines, and `CMD-1` / `SRGH-50`, pack sizes the supplier does
not sell (the form has only `CMD-10` and `SRGH-200`). To bring one back, add
its catalogue entry again and set the row to draft in Admin → Products.

## Wholesale cost (admin-only)

Cost price lives in `shop_product_costs` (one row per product), **not** on
`shop_products`: the products table is publicly readable column-for-column
through the anon key, and cost is commercially sensitive. The costs table has
RLS with an admin-only policy and no public policy, so anonymous and
non-admin clients get nothing.

- Columns: `wholesale_ex_gst_aud`, `wholesale_inc_gst_aud` (stored as the
  supplier quotes them), `supplier`, `supplier_sku`, `source`, `notes`.
- Admin → Products shows **Cost (inc)** and **Margin** per row and the edit
  form has ex/inc GST cost fields (enter either; the other is derived at 10%).
- **Margin** is ex-GST gross margin: `(price ÷ 1.1 − cost ex GST) ÷ (price ÷ 1.1)`,
  because every selling price is GST-inclusive and CardPop remits that GST.
- `data/shop-rrp.csv` carries the same figures in `wholesale_ex_gst_aud` /
  `wholesale_inc_gst_aud` / `supplier_sku`; `scripts/apply-shop-rrp.mjs`
  upserts them (`--skip-costs` to ignore). The September 2026 figures were
  seeded by `supabase/migrations/*_shop_product_costs.sql` on merge.
