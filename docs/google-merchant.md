# Google Merchant Center product feed

CardPop exposes its shop catalogue to Google Merchant Center as a **scheduled
fetch feed** — Google pulls a single URL on a schedule, so there's no API
authentication, OAuth, or per-product push to maintain.

- **Feed URL:** `https://cardpop.com.au/merchant-feed.xml`
- **Generator:** `api/merchant-feed.js` (Vercel serverless function, routed via
  the `/merchant-feed.xml` rewrite in `vercel.json`, capped at 10s)
- **Source data:** every `shop_products` row with `status = 'active'`
- **Format:** RSS 2.0 with the Google `g:` namespace
  (`http://base.google.com/ns/1.0`)

The platform-owned shop (`shop_products`) is included. The user marketplace
(`listings`) is intentionally **not** — third-party/used single-card listings
with fluctuating per-item stock need per-listing condition and availability
handling that this feed doesn't attempt.

## Does it cost anything?

No. Merchant Center itself and organic **free product listings** (Shopping tab
/ Search) are free. You only pay if you separately choose to run **Google Ads /
Shopping (Performance Max)** campaigns on top of the catalogue.

## Field mapping

| Google attribute | Source | Notes |
|---|---|---|
| `g:id` | `shop_products.id` | Stable UUID |
| `title` | `title` | |
| `description` | `description` | HTML stripped, ≤5000 chars; falls back to a generated line |
| `link` | — | `/product/shop/<id>/<slug>` (same canonical URL as the sitemap/prerender) |
| `g:image_link` | `images[0]` or `image_url` | CDN-rewritten when `IMAGE_CDN_HOST` is set |
| `g:additional_image_link` | `images[1..10]` | Extra photos |
| `g:availability` | `stock_quantity` | `in_stock` when `> 0` (or null), else `out_of_stock` |
| `g:price` | `price_aud` | `"<amount> AUD"` |
| `g:condition` | — | Always `new` (shop products are new stock) |
| `g:identifier_exists` | — | Always `no` — see below |
| `g:google_product_category` | `product_type` / `category` | Set to *Collectible Trading Cards* for singles/sealed; omitted otherwise so Google auto-classifies |
| `g:product_type` | `category` | The store's own category breadcrumb |

Products missing a title, a positive price, or an image are **skipped** — Google
disapproves such items, so it's cleaner to leave them out of the feed than to
submit entries that fail review.

### Why `identifier_exists = no`?

`shop_products` carries no GTIN, MPN, or brand, so the feed declares that no
unique product identifiers exist rather than asserting a brand (e.g. "CardPop")
that Google would then expect a matching GTIN for. This is the honest,
disapproval-avoiding default for a mixed catalogue.

To improve eligibility and performance later, add real per-product identifiers
(sealed booster boxes generally have a manufacturer **brand** and a **GTIN**
barcode). That would mean adding `brand`/`gtin` columns to `shop_products` and
emitting `g:brand` / `g:gtin` here instead of `g:identifier_exists`.

## One-time Merchant Center setup

1. Create/verify a Merchant Center account for `cardpop.com.au` (verify + claim
   the domain — Google can use the existing Search Console verification).
2. Fill in **business info**: contact details, and account-level **shipping**
   and **returns/refund** settings (Australia). These live in Merchant Center,
   not in the feed.
3. Make sure the public policy pages are reachable: `/returns`, `/shipping`,
   `/privacy-policy`, `/terms`, `/contact`.
4. **Products → Feeds → Add feed** → country **Australia**, language **English**,
   method **Scheduled fetch**, URL `https://cardpop.com.au/merchant-feed.xml`,
   and a daily fetch schedule.
5. Submit and wait for review (typically a few days). Expect some initial
   disapprovals — usually a missing policy page or a product field — and fix
   iteratively.

## Local check

```bash
# Unit tests
npx vitest run tests/backend/merchant-feed.test.js
```

The endpoint always returns a 200 with valid XML: a slow database read (>7s)
degrades to an empty-but-valid feed rather than a 504 that Google would report
as a fetch error.
