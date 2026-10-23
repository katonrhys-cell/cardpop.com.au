# Google Merchant Center product feed

Merchant Center otherwise finds products by crawling the `Product` structured
data on every page, which includes **community sellers' cards**. The feed lists
only what CardPop itself sells:

- **Shop products** — `shop_products` with status `active` or `preorder`, keyed
  by SKU (the same id `/checkout?id=` accepts).
- **Official CardPop Store cards** — active buy-now (`fixed`) listings whose
  seller is an admin, keyed by listing id.

Code: `utils/merchantFeed.js` (row builders, TSV), `api/merchant-feed.js`
(queries), rewrite `/merchant-feed.tsv` in `vercel.json`. Cached 15 minutes at
the edge; a DB failure answers 503 so Merchant Center keeps its last good fetch.

## Pre-orders

Merchant Center needs an ISO `availability_date`; `shop_products.preorder_eta`
is free text. `preorderAvailabilityDate()` reads a month (and optional year)
from it — "December 2026" → `2026-12-01`. An estimate naming no month ("Ships
when stock arrives") leaves that product **out of the feed** rather than listing
a made-up date. Write pre-order estimates with a month.

## Setting it up in Merchant Center

1. **Products → Data sources → Add product source → Scheduled fetch.** Name it
   "CardPop feed", country Australia, language English, file name
   `merchant-feed.tsv`, fetch URL `https://cardpop.com.au/merchant-feed.tsv`,
   daily.
2. Fetch now and check **Diagnostics** for errors.
3. Once it is clean, turn off or delete the website-crawl / structured-data
   source so community cards stop being picked up. Check **Products** shows only
   the feed's items.

## Notes

- Shipping and returns come from the account-level Merchant Center settings, not
  the feed. The shop's 14-day policy is registered there; Official Store cards
  follow the marketplace rules (`utils/buyerProtectionPolicy.js`) — review that
  the account settings are acceptable for both.
- Cards are `condition = used`, with `brand` + `mpn` (no GTIN).
- A product with no image, no price or (shop) no SKU is skipped, not guessed.
