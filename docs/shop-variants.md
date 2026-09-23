# Shop colour variants & barcodes

Most Palms Off Gaming lines come in several colours, each with its own SKU and
EAN barcode. `shop_product_variants` holds one row per sellable unit (colour)
of a `shop_products` row.

## Model

| Column | Meaning |
|---|---|
| `product_id` | parent `shop_products` row |
| `sku` | the variant's SKU (upper-cased, unique) — the supplier's per-colour SKU for wholesale lines |
| `barcode` | EAN, unique where present. Printed on the packaging, so publicly readable |
| `colour`, `colour_hex` | display name and optional swatch |
| `stock_quantity` | stock **per colour** |
| `price_aud` | optional override; `null` = the product price |
| `status` | `active` \| `archived` (hidden but history kept) |

Rules enforced by triggers in `supabase/migrations/*_shop_product_variants.sql`:

- **Parent stock is derived.** When a product has ≥1 active variant,
  `shop_products.stock_quantity` = sum of active variant stock and
  `has_variants = true`. Everything that already keys off product stock
  (sold-out ribbons, `isSoldOut()`, the Finance stock valuation) keeps working.
- A product with **no** variants behaves exactly as before: stock and price on
  the product row.

## Buying

- Product pages (`/product/shop/…`, the Palms Off product and binder pages)
  show `VariantPicker` (colour chips; sold-out colours visible but disabled).
  Add to cart requires a colour; a single-variant product auto-selects.
- Cart lines are identified by variant id, so two colours of one product are
  two lines. `CheckoutPage` sends `variantId` with each shop item.
- `cartService.priceCart` loads variants with the product (one query), requires
  a variant when any exist (400 "choose a colour"), checks **variant** stock
  (409), applies a variant price override, and stamps `variant_id`,
  `variant_sku`, `variant_colour`, `variant_barcode` on the order line. The
  line title becomes "Product — Colour" (also on the Stripe line item).
- The Stripe webhook decrements `decrement_shop_variant_stock(variant_id, qty)`
  for variant lines (returns false on oversell → flagged like the product
  path), `decrement_shop_stock` otherwise.
- Grid cards can't know the colour, so a product with variants shows
  **Choose colour** linking to its page instead of Add to Cart.

## Admin

Admin → Products → edit: a **Colour variants** table (colour + swatch, SKU with
an auto-suggested `<PRODUCT-SKU>-<COLOUR CODE>`, barcode, stock, price
override, active tick, remove). With variants present the product's stock
field is read-only and shows the sum. Search matches variant SKUs, barcodes
and colours, so a barcode scan finds the parent product.

## Seed

190 variants across 54 lines were seeded from the Palms Off Gaming order form
(September 2026), matched by `shop_products.sku`: multi-colour lines carry the
supplier's per-colour SKU and barcode; single-colour lines get one variant
using the product's own SKU. Mag Lock cases note that the barcode is the
supplier's display carton. All seeded stock is 0.
