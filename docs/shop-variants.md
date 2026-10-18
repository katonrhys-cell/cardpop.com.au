# Shop colours: colour families & colour variants

There are two ways to sell a line in several colours:

- **Colour family (the default for Palms Off Gaming)** — one `shop_products`
  row **per colour**, linked by `family_sku`. Each colour has its own grid card,
  price, RRP, stock, barcode, wholesale cost (`shop_product_costs`) and photos.
  Use this when colours should be listed and priced individually.
- **Colour variants** — one product with a `shop_product_variants` row per
  colour (below). One grid card; colours share the product's price unless a
  variant overrides it.

## Colour families

| Column on `shop_products` | Meaning |
|---|---|
| `family_sku` | the line SKU shared by every colour, e.g. `ZB-04` |
| `colour`, `colour_hex` | this product's colour name and optional swatch |
| `barcode` | the EAN printed on the packaging |

- **Shop grids** list every colour as its own product (they're ordinary rows).
- **Product pages** load the family (`utils/shopFamily.js`) and show the
  siblings as colour chips. On `/product/shop/:id` a chip opens that colour's
  page; on the catalogue-driven line pages (`/shop/<category>/<line>`,
  `/shop/binders/<line>`, via `hooks/useShopLine.js`) a chip swaps price,
  stock, photos and the product added to the cart in place.
- **Admin** → Products → edit → *Colour family*: set the same family SKU on each
  colour product, plus its colour, swatch and barcode. Price each one
  separately. Search finds colours, family SKUs and barcodes.
- Checkout needs nothing special — each colour is a plain product.

`20260926024651_split_palms_off_colours_into_products.sql` converted the 17
multi-colour Palms Off lines (153 colours) from variants into families: each
active colour variant became a product (title `<line> — <Colour>`, slug
`<line-slug>-<colour>`, the variant's SKU/barcode/stock, its price override or
the line price, the line's cost, and the photos in storage whose file name
starts with `<COLOUR SKU>_`, falling back to the line's photos), then the
combined line rows and their variants were archived (kept for order history).
Single-version lines lost their one colourless "variant" (it only duplicated
the product and drew a one-chip picker); its barcode moved onto the product.

## Colour variants

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

## Sizes

The same rows sell a line by **size**. Put the size in the `colour` column
(`Small`, `Medium`, `Large`, `XL`, `2XL`…) with no hex: `variantKind()` in
`utils/shopVariants.js` calls a product's variants *sizes* when every active
one is a size name (`isSizeName()`), and the picker heading, the grid's
"Choose size" button, the product-page toasts and the cart's 400 message all
follow it. Anything else (or a mix) is a colour choice, as before. Order the
sizes with `sort_order` — the default sort is sort order then name, which
would put 2XL before Small.

First use: the **Black Nitrile Heavy Duty Gloves - Box of 100**
(`CP-GLOVES-NITRILE-100-PACK`, Shield Right XtraGuard, bought from Werko) —
five sizes, SKUs `SR1361`–`SR1365`, seeded by
`20261018103000_nitrile_gloves_sizes_and_werko_supplier.sql`.

## Admin

Admin → Products → edit: a **Colour / size variants** table (colour + swatch, SKU with
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
