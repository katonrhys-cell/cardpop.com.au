# SEO Assessment — CardPop

## Current state (better than typical)

- **Static `<head>` is strong**: title, description, keywords, canonical, full
  Open Graph + Twitter cards, `en_AU` locale, theme-color. (`index.html`)
- **Site-level JSON-LD**: `WebSite` + `SearchAction` (sitelinks search box),
  `Organization`, `OnlineStore`. (`index.html`)
- **Per-page meta** via `SEOHead` (react-helmet): title/description/canonical/
  og-image/structured-data.
- **Product JSON-LD** now on both listing routes:
  - `VaultListingDetailPage` (already had it)
  - `MarketplaceListingPage` — **added**: `Product` + `Offer` (price, AUD,
    condition, availability) + `BreadcrumbList`, canonical, og:image.
- **robots.txt** correctly allows public content and disallows
  auth/account/vault/admin/checkout. **Sitemap** is served at `/sitemap.xml`
  (Express `sitemap` route, tested).

## The ceiling: client-side rendering (CSR)

The served HTML is an **empty `#root`** — all body content is rendered by JS.
Consequences:

1. **Googlebot** can render JS, so it *eventually* indexes content — but with a
   delay and a crawl-budget cost, and JS-render failures silently drop pages.
2. **Per-page meta/JSON-LD is injected client-side** (react-helmet). A crawler
   that doesn't execute JS sees the **generic homepage `<head>` on every URL** —
   so a specific listing, category, or blog post has no unique title/description/
   structured data in the *raw* HTML. This is the single biggest SEO limitation.
3. **Bing, social unfurlers, and most AI crawlers** don't run JS well → they get
   the homepage meta for every link shared.

For a marketplace whose growth depends on long-tail listing/category pages being
indexed and shared, this is the thing to fix.

## Options for the rendering problem (decision required)

| Option | Effort | What it fixes | Risk |
|---|---|---|---|
| **A. Prerender static routes at build** (`vite-plugin-prerender` / `@prerenderer`) | Low–med | Home, info, FAQ, about get real HTML | Adds a headless browser to the build → must be proven on Vercel's build env or it breaks deploys |
| **B. Prerender service for crawlers** (prerender.io / Prerender + Vercel middleware) | Med | *All* pages, including dynamic listings, get rendered HTML to bots only | External dependency + cost; cache invalidation |
| **C. SSR / meta-framework migration** (Next.js / Remix / Astro islands) | High | Best-in-class: real SSR/ISR per page, fastest indexing, also improves LCP | Large migration of a 127-page SPA |
| **D. Edge meta injection** (Vercel middleware rewrites `<head>` per route from the DB) | Med | Correct per-page title/description/OG/JSON-LD in raw HTML without full SSR | Custom middleware to maintain |

### Recommendation
- **Short term (safe, now):** the structured-data + canonical/og work above is
  done. Verify pages with Google Rich Results Test + Search Console URL
  Inspection to confirm Googlebot renders them.
- **Medium term:** **Option D** (edge middleware that injects per-route
  `<head>` from Supabase) gives ~90% of the SEO benefit of SSR for listings and
  categories at a fraction of the cost, and keeps the SPA. Pair with **Option A**
  for static marketing pages.
- **Long term:** if SEO becomes the primary growth lever, **Option C** (migrate
  to a meta-framework with ISR) is the durable answer and also fixes LCP.

This is an architecture decision with deploy-pipeline implications, so it's left
for explicit sign-off rather than changed unilaterally.

## Smaller follow-ups
- [ ] Category pages: `ItemList` / `CollectionPage` JSON-LD + unique meta.
- [ ] Blog posts: confirm `Article` JSON-LD + author/date (BlogArticlePage already emits some).
- [ ] Generate per-listing OG images (dynamic) for richer social unfurls.
- [ ] Submit sitemap in Search Console; monitor coverage + Core Web Vitals report.
      (Step-by-step instructions + GA4 SPA-tracking admin step: `docs/seo-analytics.md`.)
- [ ] Add `hreflang`/locale if expanding beyond AU.
