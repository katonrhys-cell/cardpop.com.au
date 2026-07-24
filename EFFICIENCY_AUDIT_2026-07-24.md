# Site Efficiency Audit — 2026-07-24

Full-stack efficiency review: production build measurement, frontend data
fetching, React rendering, backend/serverless, database indexes/queries, and
the delivery layer (Vercel config). Baseline at time of audit: build 6.5s,
initial JS payload **206.9 KB gzip** (budget 320 KB), all 2,370 tests passing.

Findings are ranked by expected real-world impact. Each item was verified
against the code (file:line), not just pattern-matched.

---

## Measured baseline

| Metric | Value | Notes |
|---|---|---|
| Initial JS (gzip) | 206.9 KB | `tools/check-bundle-size.js`; 113 KB headroom under budget |
| Largest critical-path chunks | `index` 51.8 KB, `supabaseClient` 50.3 KB, `vendor-react` 43.7 KB, `vendor-router` 14.6 KB (gzip) | supabaseClient includes the realtime/websocket client |
| Largest lazy chunks | `opencv` 3,546 KB gzip (10.8 MB raw), `CartesianChart` (recharts) 94 KB, `LocalMapPage` (leaflet) 51 KB | all correctly lazy — no page-load cost |
| dist/ size | 19 MB (11 MB is opencv) | deploy weight only |
| Tests | 193 files / 2,370 passed | green baseline |

Already excellent (verified, no action needed): route-level lazy loading,
manual chunk strategy in `vite.config.js`, critical-CSS/home-shell pipeline,
deferred Sentry/analytics in `main.jsx`, `lib/queryCache.js` SWR cache,
`useCategories` caching, Header count-only queries, immutable asset caching in
`vercel.json`, `api/prerender.js` CDN caching (`s-maxage=3600`), trigram
indexes for the main name searches (`20260723023045`), RLS initplan wrapping
(`20260719071049`), FK index sweep (`20260719065637`).

---

## HIGH impact

### H1. Per-card watchlist queries + realtime channels on marketplace grids
`hooks/useWatchlist.js:11-58`, called from `components/MarketplaceListingCard.jsx:26`.
Every rendered listing card runs its own full `watchlist` select AND opens its
own realtime channel `watchlist-ids-${uid}`. A 24-card marketplace page =
~24 identical queries + 24 websocket subscriptions per authenticated visitor,
each holding an independent `ids` Set (so a toggle on one card doesn't update
siblings).
**Fix:** lift to a single `WatchlistProvider` mounted once in `App.jsx`;
cards consume shared `isWatchlisted`/`toggle` from context. One query, one
channel, consistent state.

### H2. Browse surfaces over-select the wide `vault_items` row
- `pages/marketplace/MarketplacePage.jsx:218-220`
- `pages/collections/CollectionPage.jsx:494` (and section queries at 352, 382, 413, 443)
- `pages/SearchResultsPage.jsx:59`
- `pages/HomePage.jsx:295` (cached, limit 4 — minor but same pattern)

All use `select('*, vault_item:vault_items!inner(*, vault_images(*)), …')`,
pulling every column of `listings` and `vault_items` (AI-identify blobs,
notes, grading data, arrays) plus **all** images per card, when the grid card
renders ~10 fields and one thumbnail. This is the highest-traffic query in
the app and directly burns Supabase egress (which is metered) as well as
latency.
**Fix:** define one shared `LISTING_CARD_SELECT` constant with the explicit
columns the card renders and use it on all four surfaces; select only the
primary image (or order `vault_images` and limit 1).

### H3. Marketplace grid has no supporting DB index for its filter+sort
`pages/marketplace/MarketplacePage.jsx:218-265` runs
`listings … .in('status',['active','sold']).neq('listing_type','vault').order('created_at' desc)`
paginated with `count:'exact'`. No migration creates `listings(status)` or a
`(status, created_at)` composite — only `grading_*` and `accepts_trade`
indexes exist on `listings`.
**Fix (migration):**
`CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at DESC);`

### H4. `sql/performance_indexes.sql` is dead AND targets non-existent columns
`sql/performance_indexes.sql` was never applied (it's not in
`supabase/migrations/`, and CLAUDE.md forbids dashboard SQL), and it indexes
`vault_items(title, artist)` — the real columns are `card_name`/`set_name`.
So the homepage/marketplace composite indexes it promises
(`idx_vault_items_public_active_created`, `idx_profiles_featured_active`,
etc.) **do not exist in production**.
**Fix:** replace with a real migration (`supabase migration new`) using
correct column names; delete the misleading file. Fold in H3, M4, M6, M7.

### H5. `count: 'exact'` on hot public grids
`MarketplacePage.jsx:220`, `CollectionPage.jsx:495`, `CategoryPage.jsx:39`,
`MyVaultPage.jsx:59`, `ShopSinglesPage.jsx:37`, `ShopCategoryPage.jsx:61`,
`ShopSealedBoxesPage.jsx:37`, `ShopCollectionPage.jsx:183`,
`SoleTraderStorePage.jsx:94`, `PublicSellerProfilePage.jsx:72`.
Every load/pagination runs a full exact `count(*)` over the filtered set —
without covering indexes that's a bitmap/seq scan per view.
**Fix:** `count: 'estimated'` for public grids (pagination UIs tolerate it),
or land the composite indexes so counts are index-only scans.

### H6. `sharp` native binary loads on every serverless cold start
`src/utils/compressImageBuffer.js:1` does a top-level `import sharp from 'sharp'`,
reached via `src/routes/integrated-ai.js` → `src/routes/index.js`, so the
native addon loads on **every** cold start of the single Express function —
even for requests that never touch images. This defeats
`src/utils/imageProcessor.js:9-20`, which deliberately lazy-loads sharp for
exactly this reason.
**Fix:** mirror `getSharp()` — `await import('sharp')` inside
`compressImageBuffer()`.

### H7. In-memory caches don't survive serverless instances
`src/utils/ebayCache.js:3`, `src/utils/cardImageResolver.js:29`,
`src/utils/exchangeRates.js:4` cache in module memory. On Vercel each
concurrent/rotated instance starts empty, so the 30-day card-art and 24-hour
FX TTLs are largely illusory, and quota-limited upstreams (eBay, card APIs)
get re-hit. Additionally `src/routes/ebay.js:23` (`/search`) and `:78`
(`/price-estimate` — two upstream calls each, AU+US) are not cached at all;
only popular-cards uses the cache.
**Fix:** back these with a shared store (a small Supabase table fits — the
code already has the service-role client; FX is literally 1 row), then wrap
`/search` and `/price-estimate` in it.

---

## MEDIUM impact

### M1. `AuthContext` provider value is not memoized
`contexts/AuthContext.jsx:447` — `mergedUser` is memoized but the `value`
object is rebuilt every render. AuthProvider re-renders on token refresh
(fires on tab refocus), MFA checks, profile updates — each rebuild re-renders
every `useAuth()` consumer (Header + whole page tree).
**Fix:** wrap `value` in `useMemo`. Same (trivial) fix for
`contexts/PlatformSettingsContext.jsx:36`.

### M2. Messaging refetch storm
`pages/MessagingPage.jsx:129` subscribes unfiltered to all `messages` INSERTs
and refetches the entire conversation list (200-row scan + profiles `.in()`)
on every event; `loadThread` (:234) and send (:274) also full-refetch.
**Fix:** filter the channel (`recipient_id=eq.<uid>` / `sender_id=eq.<uid>`)
and apply payloads to local state instead of refetching.

### M3. Notifications refetch on every realtime event
`hooks/useNotifications.js:46-54` refetches 50 rows per INSERT/UPDATE;
`markAllRead` (:65-70) updates N rows → N refetches.
**Fix:** apply the payload locally; skip self-originated updates.

### M4. Header badge counts lack partial indexes
`components/Header.jsx:164-175` runs on every authenticated page:
`messages` count `.eq('recipient_id',uid).is('read_at',null)` and `trades`
count `.eq('responder_id',uid).eq('status','proposed')`. `messages` has no
data indexes; `trades.status` unindexed.
**Fix (migration):**
`CREATE INDEX idx_messages_recipient_unread ON messages(recipient_id) WHERE read_at IS NULL;`
`CREATE INDEX idx_trades_responder_status ON trades(responder_id, status);`

### M5. Auth middleware round-trips to Supabase per request
`src/middleware/auth.js:24` calls `supabase.auth.getUser(token)` (network) on
every protected request; `isAdminUser` (:66-78) adds a `profiles` query per
admin request because `is_admin` isn't mirrored into JWT `app_metadata`.
**Fix:** verify the JWT locally (jose + project JWT secret) with a small
revocation-sensitive allowlist still going remote; mirror `is_admin` into
`app_metadata` on grant/revoke.

### M6. CategoryPage: leading-wildcard `ilike` on unindexed `listings.category`
`pages/CategoryPage.jsx:38-46` — `ilike('category','%..%')` + status filter +
created_at sort + exact count = full scan per public browse.
**Fix (migration):**
`CREATE INDEX idx_listings_category_trgm ON listings USING gin (category gin_trgm_ops);`
(plus H3's composite). Same gap for `shop_products.category`
(`ShopCategoryPage.jsx:66`, `ShopCollectionPage.jsx:187`).

### M7. Conversation list OR-query has no supporting indexes
`pages/MessagingPage.jsx:52-57` — `.or(sender_id, recipient_id).order(created_at desc).limit(200)`.
**Fix (migration):** `idx_messages_recipient_created(recipient_id, created_at DESC)`
and `idx_messages_sender_created(sender_id, created_at DESC)`.

### M8. MarketplacePage recomputes grouping on every keystroke
`pages/marketplace/MarketplacePage.jsx:188-205, 323-337` — `groupedSets`,
`seriesGroups`, `groupByFranchise`, `getBreadcrumb()` run unmemoized on each
render; typing in search re-renders per keystroke over the full option lists.
**Fix:** `useMemo` on their actual deps.

### M9. Homepage featured queries lack their intended partial indexes
`pages/HomePage.jsx:295-327` — featured vault items / public items / featured
sellers have no composite or partial indexes (the intended ones are stranded
in the dead file, H4). Cached 5 min, so medium.
**Fix:** include corrected versions in the H4 migration.

### M10. Cold-start weight: `cheerio` + eager Stripe client
`src/utils/psaScraper.js:1` (cheerio, only used on a rare scrape fallback)
and `src/utils/stripeClient.js:5` (`new Stripe(...)` at module load) both run
on every cold start of the monolith.
**Fix:** dynamic `import('cheerio')` inside the scraper; `getStripe()`
lazy accessor.

### M11. Search suggestions: serial queries, no cache, `%q%` scans
`src/routes/search-suggestions.js:29-86` — two independent queries awaited in
series, plus fallback + 100-row fuzzy fetch, per keystroke, unauthenticated,
uncached. (`vault_items` name columns are trgm-indexed; the pattern is still
serial + uncached.)
**Fix:** `Promise.all` the independent queries; add a short shared cache.

---

## LOW impact

- **L1.** `pages/ProductDetailPage.jsx:165-240` — vault path is a serial
  waterfall (item → active listing → sold listing → owner profile); collapse
  the two listing lookups into one query and drop the redundant profile fetch.
- **L2.** `src/routes/recommendations.js:38,46` — independent wishlist/orders
  queries awaited serially; every branch selects `*` + nested joins for a
  small strip. `Promise.all` + explicit columns.
- **L3.** Dead second toast system: `@radix-ui/react-toast` chain
  (`components/ui/toast.jsx`, `ui/toaster.jsx`) is never mounted;
  `hooks/use-integrated-ai.jsx:2` still calls `use-toast` so those toasts
  render nothing. Remove the dep/files; route through sonner.
- **L4.** `components/MarketplaceListingCard.jsx:225` — seller avatar `<img>`
  missing `loading="lazy"` (24 per grid page).
- **L5.** `vercel.json` — the headers blocks for `/assets/`, `/images/`,
  `*.woff2`, and favicons are duplicated verbatim (≈lines 328-374 vs
  525-550). Dead config weight; delete one copy.
- **L6.** `SearchResultsPage.jsx:112-116` — blog search selects `*` including
  full article `content` to render title/excerpt only.
- **L7.** RLS: `20260721103000_create_shop_affiliate_products.sql:52-62` uses
  bare `auth.uid()` (initplan per-row re-eval) — the one policy missed by the
  `20260719071049` wrapping sweep. Admin-only small table; wrap for
  consistency.
- **L8.** `components/Header.jsx:119` — `setInterval(..., 500)` DOM cleanup
  runs forever on every page; consider event-driven cleanup.
- **L9.** Admin dashboards run multiple exact counts over full tables
  (`AnalyticsReportsPage.jsx:94-98`, `AdminDashboard.jsx:113-124`, etc.) —
  fine at admin frequency; switch to estimated counts if they slow down.
- **L10.** `orders` history OR-queries (`TransactionHistoryPage.jsx:24`,
  `AccountDashboard.jsx:72`) have no `(buyer_id/seller_id, created_at)`
  composites — optional until order volume grows.
- **L11.** opencv chunk is 11 MB of the 19 MB deploy (lazy, so no page-load
  cost). Optional: serve it from a CDN/static host or load on explicit user
  action with a progress UI, mostly to cut deploy weight.

---

## Suggested execution order

1. **One DB migration** (H3 + H4 + M4 + M6 + M7 + M9 + L7): all the missing
   indexes with corrected column names, plus the one RLS wrap. Biggest
   server-side win, zero app-code risk. Delete `sql/performance_indexes.sql`.
2. **Shared `LISTING_CARD_SELECT`** (H2, L6): explicit column projections on
   the four browse surfaces — biggest egress/latency win.
3. **WatchlistProvider** (H1): one query + one channel instead of N.
4. **Serverless cold start + caching** (H6, H7, M10): lazy sharp/cheerio/
   Stripe; Supabase-table-backed cache for FX/eBay/card-art.
5. **Render hygiene** (M1, M8, L4): memoize AuthContext/PlatformSettings
   values, memoize marketplace grouping, lazy avatars.
6. **Realtime discipline** (M2, M3): payload-applied updates instead of
   full refetches.
7. `count: 'estimated'` on public grids (H5) once index work lands.
