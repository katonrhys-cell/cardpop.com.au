# SEO & Analytics — how it works and the manual checklist

## Analytics stack

Three independent, complementary systems run in production:

| System | What it measures | Where |
|---|---|---|
| **Google Analytics 4** (`G-NCZ6K9VFF8`) | Visitors, page views, traffic sources, audience | `lib/analytics.js`, loaded lazily from `main.jsx` |
| **Vercel Analytics + Speed Insights** | Page views + Core Web Vitals per deployment | `main.jsx` (`@vercel/analytics`, `@vercel/speed-insights`) |
| **Cloudflare Web Analytics** *(optional)* | Privacy-friendly RUM at the edge | Beacon loaded in `main.jsx` when `VITE_CF_BEACON_TOKEN` is set |

Sentry (errors + performance traces) also runs but isn't visitor analytics.

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
  with no brand/gtin/mpn or a malformed gtin — it runs weekly from
  `.github/workflows/merchant-listings-check.yml`, which files one tracking
  issue on failure, and is the first thing to run after a Search Console
  email about Merchant listings. Admin → Products warns when a non-`CP-` SKU
  is saved with the Brand blank.
- **Prerendering for bots**: `api/prerender.js` serves real per-route HTML
  meta to crawlers (see `docs/` and `tests/backend/prerender.test.js`).
- **Sitemap**: generated live at `https://cardpop.com.au/sitemap.xml`
  (`api/sitemap.js`) — static pages plus DB-driven listings, blog articles,
  products, events, sellers, price pages and store-directory cities. It is
  advertised in `public/robots.txt`.
- **robots.txt**: allows public content, disallows auth/account/vault/admin/
  checkout/search, and carries AI-crawler rules (see `public/llms.txt`).
- **Alt text**: all JSX `<img>` elements carry `alt` attributes (components
  pass card/product names through `CardImage` etc.). DB-stored blog article
  HTML gets a fallback alt (the article title) injected at render via
  `ensureImgAltInHtml` (`utils/imageUrl.js`).

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

- After adding a new static route: add it to `STATIC_PAGES` in
  `api/sitemap.js` and give the page a `SEOHead` with unique title,
  description and canonical.
- New DB-driven content types: add a query + URL block to `api/sitemap.js`.
- Check Search Console monthly: coverage, Core Web Vitals, rich-result status.
- Larger rendering-architecture options (SSR / edge meta injection) are
  discussed in `docs/SEO_ASSESSMENT.md`.
