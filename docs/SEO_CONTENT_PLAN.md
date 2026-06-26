# CardPop SEO Content Plan

A content & keyword plan for the CardPop blog ("The Parallel Report"), built
around the site's existing structure and Australian market focus.

## Strategy

Technical SEO removes the ceiling; **content targeting Australian-specific,
commercial-intent queries is what ranks and converts.** Most trading-card
content is US-centric, so "…Australia / AUD / PSA from Australia" queries are
far less competitive and convert better.

Two built-in advantages to lean on, both already wired in the codebase:

- **`blog_articles.marketplace_keywords`** → the "Shop Cards From This Article"
  live-listings module on each article. Every article becomes an internal-link
  hub funnelling readers to live listings. Use it on *every* article.
- **`blog_articles.faqs`** → an on-page FAQ section plus `FAQPage` JSON-LD
  (rich-result eligibility). Add 4–6 FAQs to every article.

> No live search-volume data is baked in here — priorities are by intent
> strength + AU-niche competitiveness + whether we already have the data to
> answer well. Validate exact volumes in Search Console / a keyword tool.

## Keyword clusters (pillars)

| # | Cluster | Example queries | Intent | Category |
|---|---|---|---|---|
| 1 | Price guides | "how much is [card] worth", "most valuable [set] cards", "[set] price guide australia" | Commercial / evergreen | Market Watch, Population Report |
| 2 | Grading (AU) | "PSA grading cost australia", "PSA vs BGS vs CGC", "is grading worth it" | High commercial | Collector Insights (+ grading pages) |
| 3 | Sell / where-to | "where to sell pokemon cards australia", "ebay alternative trading cards" | Bottom-funnel | Industry News / Collector Insights |
| 4 | Set analysis / releases | "pokemon set release dates 2026 australia", "[set] checklist" | Mixed | Set Analysis |
| 5 | Rookie / investment | "best NBA rookie cards 2026-27", "AFL/NRL rookie cards" | Investment | Rookie Report, Investment Outlook |
| 6 | Beginner / educational | "what does PSA 10 mean", "how to spot fake pokemon cards", "how to store trading cards" | Top-funnel / E-E-A-T | Collector Insights, Parallel Spotlight |
| 7 | Local / community | "trading card shows australia 2026", "card shops melbourne/sydney/brisbane" | Local | Industry News (+ events pages) |

## Prioritised article backlog

### Wave 1 — highest ROI (commercial + we have the data)
1. Where to Sell Pokémon Cards in Australia (2026): Fees Compared — cluster 3; 3% vs eBay 13.4% angle.
2. PSA Grading from Australia: Real Costs, Timelines & Submission Routes (2026) — expand existing FAQ content into a pillar.
3. Most Valuable Modern Pokémon Cards in Australia (AUD Price Guide) — cluster 1; set `marketplace_keywords` to named cards.
4. Is Grading Worth It? A Cost/Value Calculator for Australian Collectors — pair with `GradingROIPage`.
5. eBay vs CardPop: The True Cost of Selling Trading Cards in Australia — comparison intent.

### Wave 2 — evergreen + E-E-A-T
6. What Does PSA 10 Actually Mean? Grading Scale Explained
7. How to Spot Fake Pokémon Cards (AU Buyer's Guide)
8. How to Store & Protect Trading Cards (Australian Climate Edition)
9. PSA vs BGS vs CGC: Which Grader Holds Value in Australia?
10. Per-set "Best Cards to Pull / Checklist" for each major 2026 release

### Wave 3 — recurring / seasonal (authority + freshness)
11. Monthly "Australian Market Watch" (price movers)
12. Trading Card Shows in Australia: 2026 Calendar — links to events pages
13. Sports rookie series — AFL / NRL / cricket (near-zero competition, uniquely AU)

## Per-article on-page checklist

- [ ] `seo_title` ≤ 60 chars, keyword first; `seo_description` ≤ 155 chars
- [ ] `featured_image_url` set (OG/Twitter image + `BlogPosting` image)
- [ ] `category` assigned (breadcrumb + category page)
- [ ] `marketplace_keywords` = cards/sets named in the article
- [ ] 4–6 entries in `faqs` (→ on-page FAQ + `FAQPage` rich result)
- [ ] 2–3 internal links: a `/marketplace` filter, a `/grading` page, a related article
- [ ] 1,200+ words for pillar pieces; answer the query in the first 100 words
- [ ] `published_at` set (sitemap `lastmod` + freshness)

## Cadence & measurement

- **Cadence:** 2–3 articles/week. Front-load Waves 1–2; Wave 3 recurring series keeps the site fresh cheaply.
- **Measure (Search Console):** group queries by the 7 clusters; track impressions→clicks per cluster monthly. The real KPI is marketplace clicks from articles, not pageviews.
- **Refresh loop:** quarterly, update price-guide and grading-cost articles with current numbers and re-set `published_at`.
