# Shop RRP (recommended retail price)

`shop_products.retail_price_aud` holds the manufacturer's RRP for a shop
product; `price_aud` stays the selling price. The shop shows the RRP
struck-through when it is above the selling price, and as "RRP $X" on a
product that isn't priced yet.

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
