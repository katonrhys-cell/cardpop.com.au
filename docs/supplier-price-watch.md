# Supplier links and the weekly price watch

Every shop product can record **where you order it from**. Once a week the
price on that page is checked, and every admin gets a bell notification if it
changed.

## Adding a supplier link

Admin → Products → edit the product → **Supplier**:

- **Supplier name**: free text, e.g. `Temu` or `Palms Off Gaming`.
- **Supplier link**: the page you order from. Paste a share link as-is: the
  tracking junk marketplaces add (`share_token`, `refer_page_*`, `utm_*` and
  so on) is stripped when you save, and `sku_id` / variant parameters are kept.
  The arrow button next to the field opens the link.

Shoppers never see either field. They live on `shop_product_costs`, the
admin-only table that also holds the wholesale cost, and not on
`shop_products`, whose rows are public.

Under the link the form shows the last price read, when it was checked, and
when it last changed. **Check price now** runs the check straight away.

Changing the link starts a fresh history, so the new page's first reading is
never reported as a "change" from the old page's price.

## The weekly check

The daily maintenance run (`.github/workflows/cron-daily.yml`, 19:23 UTC =
05:23 AEST, see `docs/scheduled-jobs.md`) calls `GET /api/shop-supplier-watch/run`
with the `CRON_SECRET` bearer (fail-closed). Each run checks only products whose last
check is **7 or more days** old, so each product is checked once a week, a week
after its own last check. Products that share one page (the colours of one
Temu listing) are fetched once per run. Archived products are skipped. A run
stops starting new pages after 25 seconds, because the function's budget is
40s. Anything it doesn't reach is first in line the next day.

For each page (`src/services/supplierPriceWatchService.js`):

1. It's fetched through the SSRF-safe fetcher (`src/utils/safeFetch.js`), with a
   10s timeout and a 2 MB cap.
2. The price is read by `src/utils/supplierPrice.js`, from structured data first:
   schema.org `Offer` / `AggregateOffer` JSON-LD, then `product:price:amount` /
   `og:price:amount` meta tags, then `itemprop="price"` microdata. If the page
   has none of these, its text goes to Claude (`claude-opus-5-5`, structured
   output, page treated as untrusted data) and only when `ANTHROPIC_API_KEY`
   is set. The model is told to report "no price" rather than guess.
3. The result is saved on the cost row (`supplier_price_*` columns) and
   appended to `shop_supplier_price_history`.
4. **Notifications** (`notification_type` `supplier_price_change`, linking to
   `/admin/products`) go to every admin when:
   - the price moved by a cent or more (the title says it rose or dropped,
     and the body gives the old and new price), or
   - the page **stopped** being readable. You hear about this once, not every
     week it stays broken. The last good price is kept, so the next good
     reading is compared against it.

**It only reports.** It never changes your selling price, RRP or stored
wholesale cost. Deciding what to do about a supplier price rise is up to you.

| `supplier_price_status` | Meaning |
|---|---|
| `ok` | Price read; same as last time (or the first reading) |
| `changed` | Price read and it differs from the last reading |
| `unreadable` | Page fetched but no price could be found on it |
| `error` | Page couldn't be fetched (blocked, 4xx/5xx, timeout) |

## Temu and other bot-blocking sites

Temu renders prices in the browser and actively blocks automated visitors. From
a server the page often comes back as a captcha or an error. The watch then
records `unreadable` / `error` and notifies you once. That isn't a bug in the
watch; it means that supplier can't be watched automatically. The link is still
saved, so you can open it from the product form and check by hand. Sites that
publish standard product data (most Shopify / WooCommerce wholesalers) read
reliably without the model.

The Magnetic Metal Slab Case colours were seeded with their Temu link by
`20261002222536_shop_supplier_price_watch.sql`.

## Running it by hand

- One product: **Check price now** in its edit form (admin + MFA:
  `POST /api/admin/shop-products/:id/supplier-price-check`).
- Everything due: Actions → **Cron · Supplier price watch** → Run workflow.

## Tests

`tests/backend/supplier-price.test.js` (URL clean-up, price parsing,
extraction, model fallback), `supplier-price-watch-service.test.js` (due logic,
shared pages, notifications, budget) and `supplier-price-watch-route.test.js`
(cron auth).
