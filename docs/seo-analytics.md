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
