# Bulk product upload (official shop)

How to get a large catalogue of products and hi-definition photos into the
CardPop shop without adding them one at a time.

Admin → **Shop Products** → **Bulk Import**.

---

## The two ways in

### 1. Photos only — fastest for singles

Drag a folder of photos into the importer. Each photo becomes a draft product,
titled from its filename, and you fill in prices in the review table before
importing.

Photos of the **same** product must share a name, with the difference in a
recognised suffix:

| Files | Result |
|---|---|
| `charizard-vmax-front.jpg`, `charizard-vmax-back.jpg` | one product, front photo first |
| `booster-box-1.jpg`, `booster-box-2.jpg`, `booster-box (3).jpg` | one product, three photos in order |
| `pikachu.jpg` | one product, one photo |

Recognised suffixes are a trailing number (`-1`, `_02`, `(3)`) or a side marker
(`-front`, `-back`, `-rear`, `-obverse`, `-reverse`), separated by a space,
hyphen, underscore or dot. `front` sorts first, `back` last — the first photo
becomes the product's primary image.

### 2. CSV + photos — for a real catalogue

Drop a `.csv` alongside the photos. Grab a starter file from the **CSV
template** button in the importer.

```csv
title,sku,description,price_aud,stock_quantity,category,product_type,status,preorder_eta,images
"Charizard VMAX Rainbow Rare",CP-CHARIZARD-VMAX-RR,"PSA 9.",1250.00,1,Pokémon,single,active,,"charizard-front.jpg; charizard-back.jpg"
"Prismatic Evolutions ETB",,"Pre-order.",89.95,0,Pokémon,sealed,preorder,"Ships in 2–4 weeks",prismatic-etb.jpg
```

**Columns.** Only a product-name column is required. Headers are matched
loosely — case, spaces, underscores and brackets are ignored — so `Price (AUD)`,
`price_aud` and `PRICE AUD` are the same column.

| Canonical | Also accepted | Notes |
|---|---|---|
| `title` | name, product, product name, card name | **required** |
| `price_aud` | price, price (AUD), amount, cost, rrp | **required**; `$` and thousands separators are stripped |
| `sku` | product sku, item code, code | derived from the title if absent (see below) |
| `stock_quantity` | stock, qty, quantity, inventory | defaults to 1 |
| `description` | desc, details, notes | |
| `category` | cat, collection | free text, or one of the shop categories |
| `product_type` | type | `sealed`, `single`, `accessory`, `other` — defaults to `single` |
| `status` | | `active`, `preorder`, `draft`, `archived`, `coming_soon` — defaults to `active` |
| `preorder_eta` | eta | required by the database for `preorder` rows; auto-filled if blank |
| `images` | image, photo(s), file(name), image_url | filenames (`;`, `|` or `,` separated) or full URLs |
| `slug` | | generated from the title when absent |

Unrecognised columns are ignored, and the importer tells you which ones.

**Matching photos to rows.** An `images` cell wins, matched on filename
case-insensitively, with or without the extension. A row with no usable
`images` cell falls back to matching the photo group against the product
title — so "name the photos after the products" works with no extra column.
A full `https://…` value is kept as-is, for images already hosted elsewhere.

### SKUs are mandatory

`shop_products.sku` is `NOT NULL` with a unique index, so every row needs one.
If the CSV has no `sku` column the importer derives one from the title exactly
as the single-product form's suggest button does (`CP-CHARIZARD-VMAX`), then
de-duplicates against both the batch and the existing catalogue — a collision
becomes `…-2`, `…-3` with a warning on the row. Slugs are de-duplicated the
same way, against the `shop_products_slug_key` unique index.

### The review table

Nothing is written until you press Import. Before that you can edit any cell
inline, remove rows, and set category / type / status for every row at once.

Rows are checked as you edit:

- **Errors** (red, block the row): missing name; missing, unparseable or
  negative price; a SKU with illegal characters.
- **Warnings** (amber, don't block): no photo matched; a product with this name
  already exists; a SKU or slug had to be suffixed; a `preorder` row had no ETA
  so the shop's standard fallback was used.

### What happens on import

Products are written in batches of 20, so a long import commits progressively
rather than all-or-nothing — a failure at product 400 keeps the first 399.
Photo uploads across the whole batch share one queue capped at 4 at a time;
each upload retries up to 3 times.

A product that loses *some* of its photos still imports with the rest. A
product whose photos all failed is reported in the summary rather than being
published with no image.

Variants, wholesale costs, RRP and supplier URLs are **not** part of a bulk
import — add those per product in the normal form afterwards.

---

## What happens to the photos

`utils/uploadProductImages.js` is the single path for shop photos — the
one-at-a-time form and the bulk importer both use it, so they can't drift.

Each photo produces **two** objects in the `media` bucket:

| | Size | Used by |
|---|---|---|
| `shop-products/<epoch-ms>-<rand>.opt.webp` | longest edge 2400 px, WebP q85 | product detail page, zoom |
| `shop-products/<epoch-ms>-<rand>.opt.thumb.webp` | longest edge 480 px, WebP q70 | every shop/search/category grid |

Both are compressed **in the browser** before upload, so an 8 MB phone photo
leaves as a few hundred KB. Upload the highest quality originals you have — the
pipeline downsizes; it can't invent detail.

The `.opt.webp` suffix is the same marker `scripts/optimize-shop-images.mjs`
writes for supplier imagery, and `hasThumbnail()` in `utils/imageUrl.js` keys
on it — so grids pick up the thumbnail with no change to the image layer and no
date cutoff to keep in sync.

**The marker is only used once the thumbnail has actually landed.** The thumb is
uploaded *first*; if it fails, the full image goes to an unmarked path instead
and grids simply serve the full photo. That keeps the same "both or neither"
discipline as the optimizer script: a stored URL never carries the marker
without its companion, so a grid can never 404 chasing one.

The full image is deliberately larger than the 1600 px used for user card
scans: these are hi-def product shots and the detail page offers zoom. It costs
nothing on grid pages, because grids load the thumbnail instead.

Every object is uploaded with `cacheControl: 31536000` at a timestamped path
that is never rewritten — the immutability rule from `docs/image-cdn.md`. With
`VITE_IMAGE_CDN_HOST` set, all of it is served through the Cloudflare Worker on
`img.cardpop.com.au`, keeping the traffic off Supabase's metered egress.

**Export iPhone photos as JPEG first.** Only Safari can decode HEIC, so on
Chrome or Firefox the in-browser compressor can't read the file. Rather than
store a photo most shoppers' browsers refuse to display, the uploader rejects
it, and the review table warns about `.heic`/`.heif` files before you start the
import. On a Mac: select in Finder → right-click → Quick Actions → Convert
Image → JPEG. On iPhone, Settings → Camera → Formats → **Most Compatible**
makes new photos JPEG at the source.

### Photos already in the shop

Supplier imagery uploaded at print resolution is handled separately by
`scripts/optimize-shop-images.mjs`, which converts it to the same `.opt.webp`
pair and repoints the product rows. Run that for anything added before this
pipeline existed — it is idempotent and deletes nothing:

```bash
SUPABASE_URL=https://vrfsaazuqjxotnieqlkd.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/optimize-shop-images.mjs --bucket media   # add --apply to commit
```

---

## Keeping the shop fast as the catalogue grows

- `/shop` pages in blocks of 50 with a **Load more** button, on both the
  unfiltered query and the facet-filtered path. It previously fetched a flat 50
  with no way to reach anything past it — a larger catalogue was simply
  invisible to shoppers.
- Every paged query carries `id` as a final tie-breaker. Without one, rows with
  equal prices or timestamps can reorder between pages, and products appear
  twice or not at all.
- `supabase/migrations/20261003050059_add_shop_products_browse_indexes.sql`
  adds composite indexes matching those queries exactly
  (`status, created_at desc, id` and the two price orders).

The **admin** product list still loads up to 1000 rows in one go, because its
section grouping, filter counts and variant/cost joins all operate on the whole
set in memory. That's a deliberate trade-off, not an oversight — converting it
to server-side paging means redesigning those features, and it is worth doing
only once the catalogue approaches that ceiling.

### Practical limits

The browser does the compression, so a very large import is bounded by the tab,
not the server. A few hundred photos per run is comfortable; for thousands,
split it into several runs — each one commits independently. Keep the tab in the
foreground while it works.
