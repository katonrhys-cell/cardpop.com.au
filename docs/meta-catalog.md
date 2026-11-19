# Meta catalog feed (Instagram / Facebook shopping)

`https://cardpop.com.au/meta-catalog.tsv` is the product feed Meta Commerce
Manager reads. It lets you tag shop products and Official CardPop Store cards in
Instagram posts and stories and adds a **View shop** button to the profile.
Shoppers in Australia tap through to cardpop.com.au and pay there: Meta has no
in-app checkout in AU, so pricing, GST and Stripe stay on our site.

It lists **the same products as the Google feed** (`docs/merchant-feed.md`):
shop products that are `active` or `preorder`, plus active buy-now listings by
admin sellers. Community sellers' cards are never in it. One function serves
both feeds (`api/merchant-feed.js`, `?format=meta` via the `/meta-catalog.tsv`
rewrite), so the product set can't drift apart.

Code: `utils/metaCatalogFeed.js` (maps the Google rows to Meta's format),
tests in `tests/backend/metaCatalogFeed.test.js`.

## How it differs from the Google feed

| | Google | Meta |
|---|---|---|
| `availability` | `in_stock` / `out_of_stock` / `preorder` | `in stock` / `out of stock` (the only values Meta's spec lists) |
| Pre-orders | listed only when the ETA names a month (`availability_date`) | always listed as `in stock` (they are paid for and ordered now), with the description starting `Pre-order (estimated …).` |
| `link` | plain product URL | plus `utm_source=meta&utm_medium=social&utm_campaign=catalog`, so GA4 credits Instagram/Facebook visits to the catalog |
| `identifier_exists`, `availability_date` | sent | dropped (Google-only) |

## Setting it up (one-off, in Meta's dashboards)

1. **Business account.** The Instagram account must be a Business account
   connected to a Facebook Page in Meta Business Suite.
2. **Verify the domain.** Business Settings → Brand safety → Domains → add
   `cardpop.com.au`. The DNS TXT method is the easiest: add the record in
   **Cloudflare** (it is authoritative for DNS), not Crazy Domains or Vercel.
3. **Create the catalog.** Commerce Manager → Add catalog → E-commerce → Upload
   product info → **Data feed** → **Scheduled feed**, URL
   `https://cardpop.com.au/meta-catalog.tsv`, daily, currency AUD.
4. **Check the first fetch.** Commerce Manager → Catalog → Issues. Fix product
   data in Admin → Products; the feed is regenerated (15 min edge cache).
5. **Set up the shop.** Commerce Manager → Shops → create a shop for the
   Instagram account, checkout method **on your website**. Meta reviews account
   eligibility, which can take a few days.
6. **Tag products.** Once approved, use **Tag products** when posting on
   Instagram.

## Notes

- **Cloudflare.** Meta fetches the feed with its own crawler. If Commerce
  Manager reports a fetch error (403), check Cloudflare → Security → Events for
  the blocked request. Bot Fight Mode normally lets Meta's verified crawler
  through.
- **Categories.** Shop products send no `google_product_category`. Meta infers
  one, and it isn't required for product tagging. Cards send the Collectible
  Trading Cards category.
- **Availability values.** Meta's spec has changed over time. If the feed
  validator ever rejects `in stock` / `out of stock`, change `toMeta()` in
  `utils/metaCatalogFeed.js`.
