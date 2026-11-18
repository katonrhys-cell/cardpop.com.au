# SEO & Analytics — how it works and the manual checklist

## Analytics stack

Three independent, complementary systems run in production:

| System | What it measures | Where |
|---|---|---|
| **Google Analytics 4** (`G-NCZ6K9VFF8`) | Visitors, page views, traffic sources, audience | `lib/analytics.js`, loaded lazily from `main.jsx` |
| **Cloudflare Web Analytics** *(optional)* | Privacy-friendly RUM at the edge | Beacon loaded in `main.jsx` when `VITE_CF_BEACON_TOKEN` is set |

Sentry (errors + performance traces) also runs but isn't visitor analytics. (Vercel Analytics and Speed Insights were removed in November 2026: they loaded on every page and duplicated GA4, the Cloudflare beacon and Sentry.)

GA4's visitor counts are also pulled **into the app** nightly (home page
"Visitors" tile, Admin → Dashboard → Visitors card) — see `docs/site-traffic.md`.

### How GA4 tracking works in this SPA

- `lib/analytics.js` installs the `dataLayer`/`gtag()` **command queue at boot**
  (no network cost). The actual `gtag.js` script is injected only after the
  first user interaction (`loadThirdPartyScripts` in `main.jsx`) so it never
  competes with React hydration. Queued commands replay in order when the
  script lands, so nothing recorded early is lost.
- The automatic `page_view` is **disabled** (`send_page_view: false`).
  `components/AnalyticsPageViews.jsx` sends one `page_view` for the landing
  route and one for **every client-side navigation**, waiting for the
  destination page's `<title>` (Helmet) so events carry the right title.
- GA is skipped entirely in dev, on localhost, and in e2e runs.

### Ecommerce events (the conversion funnel)

`lib/analytics.js` sends the standard GA4 ecommerce events, all in AUD:

| Event | Fired from | When |
|---|---|---|
| `view_item` | `pages/ProductDetailPage.jsx`, `pages/shop/ShopProductPage.jsx`, `pages/shop/ShopBinderProductPage.jsx` | a product/listing page loads |
| `add_to_cart` | `hooks/useCart.jsx` (`addToCart`) | any add-to-cart, whichever button |
| `begin_checkout` | `pages/CheckoutPage.jsx` | checkout opens with items (once per distinct cart) |
| `add_payment_info` | `pages/CheckoutPage.jsx` | "Review & Pay" passes validation and the payment form appears |
| `purchase` | `pages/CheckoutSuccessPage.jsx` | the Stripe session reports `paid`; `transaction_id` = session id, deduplicated in `sessionStorage` so a reload never double-counts |

Items are normalised by `toGaItem()` (`item_category` = Shop / Marketplace,
`affiliation` = seller id for listings). In GA4 → Admin → Events, mark
`purchase` as a **key event**; the Monetization reports then show funnel
drop-off (view → cart → checkout → purchase) and revenue by channel.

**Stripe return attribution:** add `stripe.com` (and `js.stripe.com`,
`checkout.stripe.com`) under GA4 Admin → Data streams → Configure tag settings
→ *List unwanted referrals*, otherwise a purchase that bounced through Stripe
is credited to a "stripe.com / referral" session.

### Advertising tags (consent-gated)

Both are dormant until their build-time env vars exist in Vercel, **and** load
only after the visitor clicks *Accept all* in the cookie bar
(`components/CookieConsentBanner.jsx`, state in `lib/consent.js`). *Essentials
only* leaves them off; *Cookie settings* in the footer shows the bar again.

| Tag | Env vars | What it gets |
|---|---|---|
| Google Ads conversion tracking | `VITE_GOOGLE_ADS_ID` (`AW-…`), `VITE_GOOGLE_ADS_PURCHASE_LABEL` | `config` on consent, a `conversion` event per purchase with value + `transaction_id` |
| Meta Pixel (`lib/metaPixel.js`) | `VITE_META_PIXEL_ID` | `PageView` per route, `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`, `Purchase` (with `eventID` = session id for dedup against a future Conversions API) |
| Impact affiliate tag (`lib/impactTag.js`) | — (tag id in the file) | `transformLinks` + `trackImpression`; never started on `/checkout`, `/login`, `/signup`, `/admin`, `/account`, `/welcome`, `/reset-password` |

GA4 itself runs regardless, with Google Consent Mode v2 defaults
(`analytics_storage: granted`, `ad_storage` / `ad_user_data` /
`ad_personalization: denied`) that flip to granted on acceptance — so Google
Ads models conversions for non-consenting visitors instead of dropping them.
The CSP in `vercel.json` allows `www.googleadservices.com` and
`connect.facebook.net` / `www.facebook.com` for these. The privacy policy's
cookies section (`pages/PrivacyPolicyPage.jsx` → "7. Cookies") describes all
three tags; keep it in step if a tag is added or removed.

### ⚠️ One-time GA4 admin step (avoid double-counting)

Because the app sends its own SPA `page_view` events, GA4's built-in history
tracking must be off, or every navigation counts twice:

1. GA4 Admin → **Data streams** → select the `cardpop.com.au` web stream.
2. Open **Enhanced measurement** (gear icon).
3. Under **Page views**, expand *Show advanced settings* and **untick "Page
   changes based on browser history events"**. Leave Enhanced measurement
   itself ON (scrolls, outbound clicks, site search etc. are still useful).
4. Save. Verify in **Reports → Realtime** while clicking around the live site:
   each navigation should register exactly one page view.

## SEO infrastructure (already in place)

- **Per-page meta**: every public page sets a unique title/description via
  `components/SEOHead.jsx` (or raw Helmet). Admin pages get an automatic
  fallback title + `noindex` from `components/AdminLayout.jsx`.
- **Structured data**: site-level `WebSite`/`Organization`/`OnlineStore`
  JSON-LD in `index.html`; `Product`/`Offer`/`BreadcrumbList` etc. per page via
  `SEOHead`'s `structuredData` prop.
- **Merchant listings identifiers**: Search Console's *Merchant listings*
  report warns "No global identifier provided (e.g., gtin, brand)" for any
  `Product` with none of `gtin` / `mpn` / `brand`. Every Product node — bot
  prerender and SPA alike — builds its identifiers through
  `utils/productIdentifiers.js`: shop products get `brand` (the
  `shop_products.brand` column, blank = CardPop; Admin → Products has a
  Brand field), `sku` + `mpn` (the SKU) and `gtin` (the `barcode` column,
  only when it is a well-formed GTIN — load them with
  `scripts/apply-shop-barcodes.mjs`); single trading cards have no GTIN, so
  they get `brand` (the franchise, normalised: `pokemon` → Pokémon,
  `Basketball (NBA)` → NBA…) and `mpn` = set + card number. A card with no
  known franchise or number gets nothing rather than an invented value.
  A card saved without a collection falls back to its vault item's franchise /
  category rows (both FKs into `categories`) in the prerender.
  Google's Rich Results Test on a product URL should show no "Missing field"
  warning for brand/gtin/mpn; the Search Console issue clears after the
  affected URLs are re-crawled (use *Validate fix* on the report).
  **Keeping it fixed**: `tests/backend/productMarkupIdentifiers.test.js`
  fails CI when a Product node is written anywhere without spreading one of
  the helpers into it (a new product surface can't ship identifier-less);
  `npm run check:merchant-listings` (`scripts/check-merchant-listings.mjs`)
  fetches a sitemap sample the way Googlebot does and reports every Product
  with no brand/gtin/mpn or a malformed gtin. Run it by hand from your own
  machine after a Search Console email about Merchant listings; the same
  markup check runs every day in process as part of the daily site check
  (below) — the weekly GitHub workflow that used to run the script was
  blocked by Cloudflare on every run and has been removed. Admin → Products warns when a non-`CP-` SKU
  is saved with the Brand blank.
- **Merchant listings shipping & returns**: every product-page `Offer` carries
  `shippingDetails` built by `utils/productShippingLd.js` — shop products quote
  the live flat rate / free-shipping threshold (Admin → Settings; the bot
  prerender reads them through the anon-callable `shop_shipping_terms()` RPC,
  `20261105090739_shop_shipping_terms_rpc.sql`, falling back to the checkout
  defaults), marketplace listings quote the seller's `shipping_cost_aud`.
  Shop offers also carry `hasMerchantReturnPolicy` (`utils/shopReturnPolicy.js`).
  Marketplace offers deliberately carry **no** return policy: schema.org can't
  express "no change of mind, full refund when not as described", so a
  "Missing field hasMerchantReturnPolicy" warning on marketplace URLs is
  expected and does not make the item invalid. Delivery times are the
  Shipping page's (`SHOP_DELIVERY_TIMES`, which that page reads). A product
  that can't be bought (coming soon, unpriced) gets no `Offer`, and a Product
  with no offer/review/rating is dropped (`isEligibleProductLd`).
- **Prerendering for bots**: `api/prerender.js` serves real per-route HTML
  meta to crawlers (see `docs/` and `tests/backend/prerender.test.js`).
- **Sitemap**: generated live at `https://cardpop.com.au/sitemap.xml`
  (`api/sitemap.js`) — static pages plus DB-driven listings, blog articles,
  products, events, sellers, price pages and store-directory cities. It is
  advertised in `public/robots.txt`. See **Sitemap** below for how its dates
  are set and how the live file is checked.
- **robots.txt**: allows public content, disallows auth/account/vault/admin/
  checkout/search, and carries AI-crawler rules (see `public/llms.txt`).
- **Alt text**: all JSX `<img>` elements carry `alt` attributes (components
  pass card/product names through `CardImage` etc.). DB-stored blog article
  HTML gets a fallback alt (the article title) injected at render via
  `ensureImgAltInHtml` (`utils/imageUrl.js`).

## Sitemap

### Where each `<lastmod>` comes from

Google only uses `lastmod` while it finds the dates believable, and it judges
the sitemap as a whole — so no date in it is typed by hand and none is "today"
unless the page changed today.

- **Pages from the database** (an event, an article, a product, a listing, a
  price page…) take that row's `updated_at`, or the latest price snapshot.
- **Static pages** (Terms, About, the grading guides, the shop hubs…) take the
  day their source files last changed. `data/sitemapPageSources.js` lists the
  files behind each page — the page component, plus its direct `@/data/…` /
  `@/config/…` imports and the policy constants, which are added automatically.
  `npm run sitemap:dates` writes the result to `data/sitemapPageDates.js` (a
  content hash and a date per page; a page whose hash is unchanged keeps its
  date). **After editing a listed page, run it and commit the file** —
  `tests/backend/sitemapPageDates.test.js` fails in CI until you do, and also
  fails when a page in `STATIC_PAGES` has no entry in the sources file. A key
  ending in `/*` covers a family of pages built from one template (the Palms
  Off Gaming lines share `data/palmsOffCatalogue.js`, so they share a date).
- **Static pages that list live rows** take whichever is newer: their file
  date, or the newest row they show. The home page follows the newest event,
  listing, product or article; `/shop`, the shop collection pages and a
  catalogue line's own page follow their products; `/marketplace` and
  `/collections/<slug>` their listings; `/blog` and each category hub their
  articles; the `/prices` hubs the newest price snapshot on them (not the
  current date — a night the price job doesn't run is not a change).

Before 2026-11 the static pages shared one constant, `2026-10-02`, and the legal
pages a hand-typed `2026-05-31`; the Terms were rewritten on 17 November and the
sitemap still said May.

### The daily site check

`/cron/site-check` (`api/site-check.js` → `src/utils/siteCheck.js`, the
`site_check` job of the scheduler Worker's daily run) checks three things:
the sitemap file, a sample of the pages it lists exactly as a crawler is
served them (about 90 a day: a few from every section, more from the product
sections), and the Product markup on the sampled product pages (every Product
has a brand, gtin or mpn — `src/utils/merchantListingsCheck.js`).

**It runs in process.** The function calls the sitemap and prerender handlers
directly and reads `vercel.json` / `public/robots.txt` from its own bundle
(`includeFiles` in `vercel.json`), so no request crosses Cloudflare. That is
deliberate: the first version ran on a GitHub runner against the public site,
and Cloudflare's **Bot Fight Mode** challenged every request (Security →
Analytics → Events showed "Managed Challenge", service "Bot fight"). The Free
plan has no way to exempt a caller from Bot Fight Mode, and the older
merchant-listings workflow had been failing the same way, unread, since
2026-10-06. What an in-process check cannot see is the edge itself — a
Cloudflare rule, a cache, DNS.

It answers 200 when clean and **502 with the problems listed** when not; the
scheduler then emails `admin@cardpop.com.au` (`docs/scheduled-jobs.md`) and the
full list is in the function's log (`[SITE_CHECK]`). Run it by hand with
`POST /run/site_check` on the scheduler Worker, or
`curl -H "Authorization: Bearer $CRON_SECRET" https://cardpop.com.au/cron/site-check`
(`?sample=50&productSample=50` covers nearly every page).

`npm run check:sitemap` (`scripts/check-sitemap.mjs`) is the same sitemap and
page checks over HTTP, for a by-hand run from a machine Cloudflare lets through
(a home connection usually is; a data-centre address is not). Both report:

| Message | What it means | Fix |
|---|---|---|
| `answered HTTP …` / `is served as …` | The function failed or the rewrite in `vercel.json` broke | Vercel runtime logs for `api/sitemap.js` |
| `does not end with </urlset>`, `has N <url> but M </url>`, `unescaped &` | Malformed XML — Google rejects the whole file | A value reached the XML without `xmlEscape()` |
| `lists N URLs — fewer than the floor` / `no /events/… pages are listed` | A section's query failed or timed out. Each section fails on its own, so the file stays valid and just gets shorter | Run the section's query from `api/sitemap.js` by hand; usually a renamed column |
| `… is missing from the sitemap` | A core page was dropped from `STATIC_PAGES` | Restore it |
| `is listed twice`, `is not on https://cardpop.com.au`, `query string`, `ends with a slash` | A URL that is not the page's canonical form | Build the URL through the shared path helper |
| `invalid lastmod` / `lastmod in the future` | A bad date in the data | Fix the row |
| `disallowed by robots.txt` / `has no "Sitemap:" line` | `public/robots.txt` and the sitemap disagree | Fix whichever is wrong |
| `is in the sitemap but is noindex` / `names another canonical` / `answers HTTP …` / `redirects` | A sampled page (fetched with a bot user-agent, so the prerender answers) should not be listed as it stands | Apply the same content gate in `api/sitemap.js` that `api/prerender.js` uses, or fix the page |
| `no bot rewrite sends it to the prerender` | A listed page has no bot rewrite in `vercel.json`, so crawlers get the empty app shell | Add the rewrite (and a renderer in `api/prerender.js`) |
| `Product markup — … no global identifier` | A Product with no brand / gtin / mpn | See Merchant listings identifiers above — usually a card with no franchise or number, or a shop row with a malformed barcode |
| `could not be read by the check` | `vercel.json` or `robots.txt` is missing from the function bundle | Restore `includeFiles` on `api/site-check.js` in `vercel.json` |

The script samples a few pages from every section (`--sample N`, `0` = the file
only; `--base <url>` fetches from a preview host). The floors and required
sections are constants at the top of `src/utils/sitemapCheck.js` — raise
`MIN_URLS` as the site grows.

Neither can see what Google made of the file — that is Search Console → Indexing → Sitemaps
(status, discovered pages, last read).

## Google Search Console — sitemap submission (manual, one-time)

The property is already verified (`public/googlee177016f79225570.html`).

1. Open [Google Search Console](https://search.google.com/search-console) with
   the account that verified `cardpop.com.au`.
2. **Indexing → Sitemaps** → under *Add a new sitemap* enter `sitemap.xml`
   → **Submit**.
3. Status should read **Success** within a few minutes; discovered URLs grow
   over the following days.
4. While there, check **Indexing → Pages** for "Crawled – currently not
   indexed" / soft-404s, and **Experience → Core Web Vitals**.

Also worth submitting to **Bing Webmaster Tools** (can import the verified
site straight from Search Console) — one click of extra coverage.

## Ongoing checklist

- After adding a new static route: add it to `STATIC_PAGE_ROWS` in
  `api/sitemap.js` and its source files to `data/sitemapPageSources.js`, run
  `npm run sitemap:dates`, and give the page a `SEOHead` with unique title,
  description and canonical.
- After editing a static page that is in the sitemap: `npm run sitemap:dates`.
- New DB-driven content types: add a query + URL block to `api/sitemap.js`.
- Check Search Console monthly: coverage, Core Web Vitals, rich-result status.
- Larger rendering-architecture options (SSR / edge meta injection) are
  discussed in `docs/SEO_ASSESSMENT.md`.
