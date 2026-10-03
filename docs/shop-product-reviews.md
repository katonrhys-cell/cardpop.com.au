# Shop product reviews

Verified-purchase reviews of **shop catalogue** products (Palms Off Gaming lines
and CardPop house products). Not marketplace cards — those are one-offs, and the
seller is already rated through `seller_ratings`.

## How it works

| Piece | Where |
|---|---|
| Table, insert guard, RLS, stats view | `supabase/migrations/20261003060100_shop_product_reviews.sql` |
| Write + moderation API | `src/routes/shop-reviews.js` → `/shop-reviews` |
| Reads (published only) | straight from Supabase in `hooks/useShopReviews.js` |
| Stars + list on product pages | `components/shop/ProductReviews.jsx` on `ShopProductPage`, `ShopBinderProductPage`, `ProductDetailPage` (house products) |
| "Review product" button | Account → Orders (`pages/account/AccountOrders.jsx`, `components/shop/WriteProductReviewModal.jsx`) |
| Moderation queue | Admin → Product Reviews (`/admin/product-reviews`) |
| Structured data | `utils/productReviews.js` `productReviewsLd()` — SPA JSON-LD and `api/prerender.js` |

**Who can review:** the buyer of a shop line on an order that is `shipped` or
`completed`, once per product per order. The `BEFORE INSERT` trigger checks the
order is theirs, shipped and contains the product, forces `status = 'pending'`
(a client can never publish its own review) and stamps the pool key and a
snapshot of the reviewer's display name. `POST /shop-reviews` writes through a
**caller-scoped** client, so RLS and that trigger are the enforcement point.

**Moderation:** every review starts `pending` and admins get a bell notification.
Publish / reject goes through `PATCH /shop-reviews/admin/:id` (service role behind
`requireAdmin`, so MFA applies) — there is no user UPDATE policy.

**Colour siblings share reviews.** The pool is `family_sku` (the line SKU), or
the product id when a product has no family (`reviewPoolKey()`; the trigger stamps
the same value as `pool_key`).

**Rating markup only describes what the page shows.** `aggregateRating` / `review`
are emitted only when there is at least one *published* review, and the count is
the full published count (`shop_product_review_stats`).

## Google

Two separate Google features use the same barcode data:

1. **Customer Reviews survey (live now).** `GET /stripe/session/:id` returns
   `gtins` (variant barcode, else `shop_products.barcode`; `src/utils/orderGtins.js`)
   and the `/checkout-success` opt-in sends them as `products: [{ gtin }]`
   (`surveyProducts()` in `lib/googleCustomerReviews.js`). Google then collects
   product reviews from its post-delivery survey. Orders with no barcodes send
   no `products` field, as before.
2. **Product ratings in Shopping / Search (follow-up).** Needs a product-reviews
   feed registered in Merchant Center and Google's approval. Not built: the
   on-site reviews here are the source it would publish.

### Loading barcodes

`shop_products.barcode` / `shop_product_variants.barcode` already exist. Fill them
from the Palms Off Gaming order form with `data/shop-barcodes.csv`:

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/apply-shop-barcodes.mjs          # dry run
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/apply-shop-barcodes.mjs --apply  # write
```

It matches by SKU (product, then colour variant), never inserts, reports a
**different** existing barcode as a conflict (`--overwrite` replaces it), and
refuses any code that fails the GTIN check digit. `TOP-09-GRN` (`936177002932`) in
the supplier's sheet fails the check digit — confirm the digit with Palms Off
Gaming before adding it. CardPop house products (`CP-…`) have no barcode and are
simply left out of the survey `products` list.

## Testing

`npm test` covers the route, helpers, planner and prerender markup. The DB rules
(guard, RLS, stats) run against a throwaway Postgres:

```bash
PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-shop-review-migrations.sh
```
