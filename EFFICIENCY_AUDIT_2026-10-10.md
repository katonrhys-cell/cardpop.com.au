# Site Efficiency Audit — 2026-10-10

Full-stack efficiency review following the homepage PageSpeed work in #992:
every public route's load profile, frontend data fetching and realtime use,
the Express backend and its cold start, the Postgres schema against the live
query statistics, image delivery and storage egress, scheduled jobs and other
recurring costs, and third-party scripts. Follows `EFFICIENCY_AUDIT_2026-07-24.md`;
the status of that audit's items is in §9 so nothing is double-reported.

Method: production build at `4425ec7` measured with Lighthouse 13.5 (mobile
emulation, Supabase blocked so retries don't skew timing), the backend entry
bundled with esbuild and cold-imported under Node 22, the live Supabase
project's statistics views and advisors (read-only), and four parallel code
reads (backend, frontend, schema, operations). Every finding cites `file:line`.
Severity is estimated from code and measurements; nothing was profiled in
production. Live site traffic was not reachable from the audit sandbox.

---

## 1. Measured baseline

### Per-route load (mobile, Lighthouse lab, Supabase blocked)

| Route | Score | FCP | LCP | TBT | Speed Index | JS (gzip) | Requests |
|---|---|---|---|---|---|---|---|
| `/` (static shell) | 93 | 0.9 s | 1.4 s | 328 ms | 1.8 s | 240 KB | ~70 |
| `/marketplace` | 69 | 2.6 s | 5.0 s | 355 ms | 2.8 s | 288 KB | 123 |
| `/shop` | 73 | 2.8 s | 6.2 s | 88 ms | 2.8 s | 336 KB | 122 |
| `/events` | 76 | 2.5 s | 5.4 s | 86 ms | 2.5 s | 277 KB | 78 |
| `/analytics` | 79 | 2.5 s | 4.8 s | 52 ms | 2.5 s | 331 KB | 59 |
| `/grading` | 81 | 2.2 s | 3.9 s | 253 ms | 2.2 s | 227 KB | 51 |
| `/collections` | 82 | 2.2 s | 4.4 s | 137 ms | 2.2 s | 240 KB | 60 |
| `/login` | 82 | 2.2 s | 4.3 s | 138 ms | 2.2 s | 257 KB | 47 |
| `/prices` | 86 | 2.0 s | 3.9 s | 100 ms | 2.0 s | 216 KB | 44 |
| `/blog` | 87 | 2.1 s | 3.8 s | 64 ms | 2.1 s | 222 KB | 51 |
| `/card-shops` | 85 | 2.0 s | 4.1 s | 91 ms | 2.0 s | 221 KB | 50 |

The homepage is now the fastest page on the site by a wide margin. Every
other route is served `app.html`, which has no static shell and a
render-blocking stylesheet, so nothing paints until the CSS and the entry JS
have both arrived and React has mounted. Those LCP figures are the *empty
state* of each page (data blocked); in production the LCP element is a card
photo that arrives only after the data query, so real LCP is later still.

### Bundle

| Item | Value |
|---|---|
| Initial JS, `index.html` (gzip) | 238.7 KB of a 320 KB budget |
| Largest initial chunks (gzip) | `index` 62 KB, `supabaseClient` 51 KB, `vendor-react` 45 KB, `vendor-router` 16 KB |
| Largest lazy chunks (gzip) | `opencv` 3.5 MB, `CartesianChart` 93 KB, `LocalMapPage` 50 KB, `AddEditCardPage` 49 KB, `vendor-sentry` 47 KB, `ShopProductPage` 43 KB, `proxy` (framer-motion) 36 KB |
| Extra per route (gzip) | `/shop` +35 KB framer-motion, `/analytics` +91 KB recharts on the hub page, `/login` +35 KB framer-motion |
| `dist/` | 22 MB (11 MB is OpenCV) |

### Backend

| Item | Value |
|---|---|
| Cold import of `src/app.js` (Node 22, this machine) | 820–860 ms before the first request can be served |
| `api/index.js` bundled (esbuild, sharp external) | 10.5 MB |
| Largest bundled packages | cheerio + parse5/encoding stack 2.4 MB (lazy-imported, still bundled), undici 1.3 MB, Sentry 1.3 MB, Anthropic SDK 0.6 MB, zod 0.6 MB, multer 0.2 MB |
| `vercel.json` `includeFiles: node_modules/@img/**` | ~46 MB, of which the musl and wasm sharp builds (~28 MB) cannot run on Vercel |

### Database (live)

| Item | Value |
|---|---|
| Row counts | listings 36, vault_items 36, profiles 65, shop_products 275, events 98, orders 0 |
| Top consumer of DB time (`pg_stat_statements`) | Realtime WAL polling: 1,084,179 calls, 8,933 s total — more than every application query combined |
| Next | PostgREST schema-cache reloads (1,426 reloads, 1,300 s), `pg_net.http_post` from the per-minute Stripe worker cron (51,448 calls), `expire_stale_offers()` every 15 min (974 calls) |
| pg_cron | job 1 every minute → `net.http_post` to the `stripe-worker` edge function (97,904 runs since 1 Aug); job 2 every 15 min → `expire_stale_offers()` |
| Advisors | 186 unused indexes, 177 multiple-permissive-policy warnings (events alone has 15), 13 unindexed FKs, 13 bare `auth.uid()` policies, 2 duplicate indexes |

At today's volume (tens of rows per hot table) no application query is slow;
sequential scans of 36 rows cost microseconds. The database cost today is
dominated by *fixed* per-connection and per-subscription work, not by query
shape. The index work in §5 is about staying fast as tables grow and is
ordered accordingly.

### Scheduled cost

~650–700 metered GitHub Actions minutes a month for schedules alone (of 2,000
included on a private repo), 360 of them from the every-2-hours payment
reconciliation. Claude API spend is roughly $12–25 a month, almost all of it
the nightly blog draft on `claude-opus-5`.

---

## 2. Headline findings (ranked by expected impact)

1. **Every non-home route paints from nothing.** `app.html` has a blocking
   `<link rel="stylesheet">` and no shell, so FCP is 2–2.8 s and lab LCP 4–6 s
   on mobile for `/marketplace`, `/shop`, `/events` — the pages that sell. The
   homepage pipeline (static header shell, inlined critical CSS, async
   stylesheet, post-paint JS) exists and can be reused: the header is identical
   on every page. §3.1.
2. **Realtime is the largest consumer of database time**, and it is driven by
   anonymous visitors: `LiveActivityTicker` (home and marketplace),
   `MarketplacePage` (every `vault_items` UPDATE, unfiltered) and
   `ProductDetailPage` all open channels for logged-out users. Every open
   marketplace tab re-runs the full listing query whenever anyone edits any
   vault item. §4.2.
3. **Two bugs in the realtime wiring**: `useNotifications` mounted twice on
   `/account/notifications` shares one channel name, which the installed
   realtime client resolves to the *same* channel object, so the second
   `.on()` throws and one unmount kills the other's subscription; and the
   product page re-subscribes with the same topic while the old channel is
   still leaving, so its "flip to Sold" updates are almost certainly never
   delivered. §4.2.
4. **Every tab refocus refetches the profile and re-runs a dozen page
   effects**, because `AuthContext` sets a new user object on every
   `SIGNED_IN` the auth library emits on visibility change. §4.1.
5. **Three public pages load whole tables**: `/collections` fetches every
   listing with `select('*')` and no limit (twice), `/events` fetches every
   event ever, and `/blog` downloads every article body to render excerpts.
   §4.3.
6. **Auth is a network round-trip on every authenticated API request**
   (`supabase.auth.getUser(token)`), sometimes twice per request, and checkout
   pricing issues ~15 + 5N sequential queries per cart. §6.
7. **The payment reconciliation cron burns more than half the scheduled
   Actions minutes** re-checking the same pending orders with Stripe every two
   hours, with no age cutoff. §7.
8. **The service worker treats card videos as images**: a 20 MB clip is
   fetched without its `Range` header, copied into R2 and stored in the image
   cache. §8.
9. **The RLS policy on `vault_items` is a correlated `EXISTS` on `listings`
   per row**, re-entered by two `vault_images` policies, evaluated for every
   card embed on every grid and for the homepage's unfiltered
   `count: 'exact'` on `vault_items`. Cheap at 36 rows; the first thing to hurt
   at 36,000. §5.
10. **Cold start carries code it cannot use**: ~28 MB of non-glibc sharp
    binaries and the Anthropic SDK (reached from three admin/cron routes) load
    into the function that serves every API call. §6.

---

## 3. Frontend delivery

### 3.1 Non-home routes (High)

`dist/app.html` is the Vite document with the shell stripped: a parser-blocking
`<link rel="stylesheet" href="/assets/index-*.css">` (35 KB gzip) and the CSP
bootstrap that injects the entry after first paint — but there is nothing to
paint, so "first paint" is a blank page and the stylesheet still gates it.

Measured consequence (§1): FCP 2.0–2.8 s and LCP 3.7–6.2 s on mobile for every
route except `/`, versus 0.9 s / 1.4 s on `/`.

Fix, reusing what the homepage already has (`vite.config.js` `homeShellPlugin`):
- Emit an **app shell** into `app.html`: the header (logo, search, nav
  placeholders — the top half of `tools/home-shell.html` is already exactly
  this) plus an empty `<main>` with the page's background. The header is
  identical on every route and React's `Header` renders the same markup on its
  first commit, so the takeover moves nothing.
- Run beasties on `app.html` too so the critical CSS is inlined and the full
  stylesheet goes `media="print"` + `data-css` through the bootstrap, exactly as
  on `/`.
- Per-route skeletons are a second step: the marketplace and shop grids could
  ship a skeleton grid in the shell (they already render one in React while
  loading), which would give those routes a real first contentful paint before
  any JS.

Expected effect: non-home FCP drops to about the homepage's 0.9 s and lab LCP
by 1.5–3 s; the Vercel/PSI numbers for `/marketplace` and `/shop` would move
from the high 60s/70s into the 85–90 range before any data work.

### 3.2 Route chunk weight (Medium)

- **framer-motion lands in high-traffic page chunks.** `pages/collections/CollectionPage.jsx:4`
  staggers a `motion` element per grid card (`:1133-1144`), `pages/shop/ShopCollectionPage.jsx:3`
  and `pages/LoginPage.jsx:5` import it eagerly; `components/ShoppingCart.jsx`,
  `ImageZoomModal.jsx` and `CardMicroscope.jsx` are already lazy. That is 36 KB
  gzip on `/shop`, `/login` and every collection page for entrance animations
  the homepage already does with CSS keyframes (`index.css` "HOMEPAGE
  ENTRANCE ANIMATIONS"). Fix: CSS animations on grid cards, lazy-load the
  motion parts elsewhere.
- **recharts (93 KB gzip) loads on the `/analytics` hub** (`pages/markets/MarketsPage.jsx`),
  not just on the detail pages that chart. Fix: lazy-import the chart
  component so the hub renders its lists first.
- **OpenCV (3.5 MB gzip) is on the default listing path.** Not on page load,
  but `prepareAnalysisImages` → `detectAndCropCard` → `loadOpenCV()` runs on
  every card identification (`pages/AddEditCardPage.jsx:901`, `pages/ScanPage.jsx:82`)
  because auto-crop defaults on (`utils/analysisImage.js:51`), and the service
  worker refuses to store files over 6 MB (`public/sw.js:144`) so it rides on the
  HTTP cache only. On slow mobile the 8 s timeout (`analysisImage.js:26`) often
  abandons the crop while the download continues. Fix: start the download when
  the camera/file picker opens, or crop server-side with sharp (already a
  dependency), or set `VITE_OCR_AUTOCROP=false`.
- `tools/check-bundle-size.js:25-29` budgets only `dist/index.html`; `app.html`
  — what every other route loads — is unchecked. Add it.

### 3.3 Rendering

- Grid cards are not memoised (`components/MarketplaceListingCard.jsx:293`,
  `ProductCard`, `VaultListingCard`): every search keystroke on
  `MarketplacePage` (`search` state, `:160`) re-renders all 24 cards, and every
  watchlist toggle changes `isWatchlisted`'s identity and re-renders every
  card. Fix: `React.memo` + a precomputed `watched` boolean.
- Filter changes on page 2+ fire two queries: the fetch runs with the old page
  number, then the page-reset effect runs it again (`MarketplacePage.jsx:407-527`,
  `ShopCategoryPage.jsx:73-148`, `ShopCollectionPage`). Reset the page in the
  same state update.
- Timers that never stop: `components/Header.jsx:113` (500 ms DOM sweep, open
  since July), `pages/account/AccountWatchlist.jsx:34` (one 1 s interval per
  auction row), `pages/HomePage.jsx:73` (16 ms `setInterval` count-up — use
  `requestAnimationFrame`), `pages/community/CommunityPage.jsx:42` (5 s
  carousel in background tabs).

---

## 4. Frontend data fetching and realtime

### 4.1 Auth refocus storm (High)

On every visibility change the auth library re-announces the session as
`SIGNED_IN` with a session read fresh from storage. `contexts/AuthContext.jsx:64-77`
responds with `setCurrentUser(newSession.user)` (a new object) and a full
`fetchProfile` (~50 columns), then `mergedUser` (`:464`) changes identity twice.
Every effect keyed on the whole user object re-runs on each refocus:
`pages/MessagingPage.jsx:107` (200-message scan + profiles), `MyVaultPage.jsx:117`,
`VaultProfilePage.jsx:88`, `UserProfilePage.jsx:70` (resets the edit form),
`TransactionHistoryPage.jsx:34`, `marketplace/MarketplacePage.jsx:336`,
`account/AccountProfile.jsx:52`, `account/AccountOffers.jsx:317`,
`VerificationSubmissionPage.jsx:59`, `AddEditCardPage.jsx:769` (re-fetches the
card being edited), `CheckoutPage.jsx:361`, `hooks/useTradeRequests.js:35-81`.

Fix: in `onAuthStateChange`, ignore events whose user id and access token are
unchanged; don't refetch the profile on `SIGNED_IN`/`TOKEN_REFRESHED` for an
already-loaded user (the `profile-${uid}` channel keeps it fresh); key the
listed effects on `currentUser?.id`.

### 4.2 Realtime (High)

Live measurement: the realtime WAL-polling query is the single largest
consumer of database time on the project (§1). The poller runs for as long as
*any* client holds a subscription, so anonymous visitors holding channels open
keep it running around the clock.

| Site | Table / filter | Opened for anonymous? | Problem |
|---|---|---|---|
| `components/LiveActivityTicker.jsx:99-107` (home, marketplace) | `listings` INSERT + UPDATE, **no filter** | yes | every listing write anywhere is RLS-checked against every connected visitor |
| `pages/marketplace/MarketplacePage.jsx:569-576` | `vault_items` UPDATE, **no filter** | yes | any private vault edit triggers a full marketplace re-query per open tab (batched to one per 5 s) |
| `pages/ProductDetailPage.jsx:361-390` | listings / vault_items / shop_products by id | yes | re-subscribes with the same topic while the previous channel is still leaving; new bindings are dropped, so live "Sold" flips almost certainly never arrive — every view still pays join + leave |
| `pages/shop/ShopCategoryPage.jsx:150-158` | `shop_products` UPDATE, **no filter** | yes | unlike its sibling shop pages, which filter by status |
| `pages/account/AccountWatchlist.jsx:239-249` | `listings` UPDATE, **no filter** | no | refetches the whole nested watchlist on any listing update site-wide; duplicates `WatchlistContext`'s channel |
| `hooks/useNotifications.js:49-65` | `notifications-${uid}` | no | mounted twice on `/account/notifications` (bell + page); the client returns the existing channel, `.on()` after subscribe throws, and either unmount removes the other's subscription. The bell is also only CSS-hidden on phones, so it fetches 50 rows and subscribes where nobody sees it |
| `components/Header.jsx:193-200` | `messages` `*`, `trades` `*` | no | read receipts (UPDATE) refetch both counts; marking N read ≈ 2N count queries |
| `pages/account/AccountDashboard.jsx:150-167` | 6 bindings | no | each event refires an RPC + 3 exact counts, unbatched |

Fixes, in order: no realtime for anonymous visitors (poll the ticker every
60 s, or none; drop the marketplace `vault_items` subscription or filter it to
`listings status=eq.active`); a single `NotificationsProvider`; subscribe on
the product page once after load with a nonce in the topic, and only for
signed-in viewers; filter the watchlist binding to the watched ids; INSERT-only
bindings with local decrements for the header badges; batch the dashboard
refetch.

Also from the schema side: `20260719121801_enable_realtime_publication.sql:44-50`
sets `REPLICA IDENTITY FULL` on `listings` and `vault_items`, so every UPDATE
writes the whole old row to WAL and the poller ships it to every subscriber for
RLS evaluation.

### 4.3 Unbounded and over-wide reads (High → Medium)

- **`pages/PublicCollectionsPage.jsx:52-56`**: two `listings select('*')`
  queries, no limit, no pagination; everything rendered at once with full-size
  `publicImageUrl` images, no `loading="lazy"`, filtered per keystroke without
  `useMemo` (`:154-162`). Grows with the marketplace, up to 2× the 1,000-row
  API cap per visit.
- **`pages/blog/BlogPage.jsx:239`**: `blog_articles select('*').limit(100)`
  including `content` and `content_html`, only to compute excerpts (`:185,:218`);
  `BlogArticlePage.jsx:216,246-249` repeats it for related articles. Likely the
  largest egress per page view on the site.
- **`pages/community/CommunityEventsPage.jsx:95-98`**: `events_public
  select('*')` with no date filter or limit, then `.in('event_id', allIds)`
  (`:113-127`). Event images bypass the CDN rewrite (`components/EventCard.jsx:16-24`,
  `EventDetailModal.jsx:20-32`, `EventDetailCard.jsx:71-80`).
- **Homepage stats** (`lib/homepageData.js:91-98`): four `count: 'exact'`
  queries per new visitor, including an unfiltered count of `vault_items`
  under the §5.2 policy; the featured-cards query is a three-step waterfall
  (`:38-76`). Serve the counts from a nightly summary row (as
  `site_traffic_summary` already does) and run the three featured queries with
  `Promise.all`.
- **Grids still select every base column**: `listings` at
  `MarketplacePage.jsx:416`, `SearchResultsPage.jsx:62`, `CollectionPage.jsx:577`,
  `PublicSellerProfilePage.jsx:53`, `SoleTraderStorePage.jsx:97`,
  `MoreFromSeller.jsx:22`; `shop_products` (including `description`, never
  rendered on cards) at `ShopPage.jsx:78`, `ShopSinglesPage.jsx:72`,
  `ShopSealedBoxesPage.jsx:72`, `ShopCategoryPage.jsx:107`,
  `ShopCollectionPage.jsx:188,248`, `utils/shopFacets.js:259`. The July work
  narrowed the embeds but not the base rows. Add `LISTING_CARD_COLUMNS` /
  `SHOP_CARD_COLUMNS` next to the existing constants.
- **Owner-private columns reach public pages**: `ProductDetailPage.jsx:144`
  (`vault_items!inner(*, vault_images(*))`), `:238`, and
  `markets/CardAnalyticsPage.jsx:262` (`vault_items select('*')` on public
  cards — the leak `lib/listingCardColumns.js` was written to close).
- **`PUBLIC_PROFILE_COLUMNS` (50 columns) where a name and avatar are shown**:
  `lib/homepageData.js:82`, `community/CommunityPage.jsx:67`,
  `community/ProfilesPage.jsx:32`, `SearchResultsPage.jsx:100`,
  `collections/CollectionPage.jsx:526,533`, the three seller pages,
  `ProductDetailPage.jsx:238,327`. Add a `PROFILE_CARD_COLUMNS`.
- **Collection strips use full uploads for 176 px tiles**
  (`CollectionPage.jsx:100-103,174-177`), up to ~34 per page, while
  `getCardImage().thumbSrc` exists. Same at `VaultProfilePage.jsx:406`,
  `account/AccountVault.jsx:132`, `account/AccountWatchlist.jsx:78`,
  `shop/ShopCollectionPage.jsx:51`, `SellerProfilePage.jsx:52`,
  `components/ShoppingCart.jsx:27,218`, `components/TradeCard.jsx:8,69`.
- Pages re-fetching the signed-in user's own profile that `useAuth().profile`
  already holds: `VaultProfilePage.jsx:48`, `UserProfilePage.jsx:43`,
  `community/LocalTradersPage.jsx:42`, `account/AccountDashboard.jsx:54`,
  `account/AccountSellerTier.jsx:85`, `account/AccountSoleTrader.jsx:68`,
  `VerificationSubmissionPage.jsx:44`.
- `contexts/CategoryContext.jsx:11-46` loads the whole `categories` table on
  every page for every visitor; its only consumer is `ShopCategoryPage`, which
  also waits on it (`:140`). It duplicates the `useCategories` cache. Delete
  the provider.
- `MarketplacePage.jsx:193-252` loads all of `manufacturers`, `teams`, `sets`,
  `parallels`, `subsets` with `select('*')` on mount to fill dropdowns the
  visitor may never open. Load each list when its select opens.
- Sequential waterfalls that key on one id: `SellerProfilePage.jsx:31-77` (five
  dependent awaits), `PublicSellerProfilePage.jsx:39-72` (three),
  `CollectionPage.jsx:385-547` (waits on categories, fires Holy Grail twice,
  4 separate pin queries), `ProductDetailPage.jsx:236-277` (vault branch,
  open since July), `CheckoutPage.jsx:162-176`.
- Admin pages that pull full tables into the browser (`RevenueBreakdownPage.jsx:82`,
  `AdminDashboard.jsx:130`, `ContentManagementPage.jsx:54`,
  `ProductManagementPage.jsx:120` + unvirtualised 1,000-row table,
  `UserManagementPage.jsx:66-74` two exact counts per user row). Fine at admin
  frequency; move totals to RPCs when they slow down.

---

## 5. Database

### 5.1 Live statistics

Every hot table is tiny (§1) and no application statement appears in the top
25 by total time. The top entries are infrastructure: realtime polling (§4.2),
PostgREST schema-cache reloads (1,426 — each `db push` and pooler restart
rebuilds it; nothing to do), the per-minute Stripe worker and the 15-minute
offer expiry. The 186 "unused index" advisor hits are mostly a consequence of
the planner preferring sequential scans on tens of rows; do not drop
indexes on that basis alone.

Two small cleanups the advisor is right about: `vault_items` has identical
`idx_vault_items_card_name_trgm` / `vault_items_card_name_idx`, and
`whatnot_shows` has identical `idx_whatnot_shows_user_id` /
`whatnot_shows_user_id_idx`. Also redundant: `card_price_snapshots_card_date_idx`
duplicates the unique `(card_id, snapshot_date)`, `saved_searches_user_id_idx`
is a prefix of `unique (user_id, params)`, `vault_items_is_featured_idx` is
superseded by `idx_vault_items_featured_created`, `idx_shop_products_status`
is a prefix of `idx_shop_products_status_created_at_id`.

### 5.2 RLS (the one that will hurt first)

`vault_items_select_access` (`20260819214352_public_read_sold_listings.sql:36-44`)
is `EXISTS (select 1 from listings where vault_item_id = vault_items.id and
status in ('active','sold')) OR (select auth.uid()) = owner_id` — a correlated
subquery per row that cannot become a join, with a second permissive policy
(`vault_items_public_featured_select`, `20260721214500:24-29`) layered on top.
`vault_images` then has **three** permissive SELECT policies, two of which
re-enter `vault_items` RLS (`20260719071049:293-295`, `20260819214352:50-57`,
`20260721214500:38-48`). Every marketplace card embeds `vault_images`, so a
24-card page nests these per image. The homepage's unfiltered
`count: 'exact'` on `vault_items` evaluates the policy for every row.

Fix: a denormalised `vault_items.publicly_listed boolean` maintained by the
existing listings trigger (`trg_sync_vault_estimated_value` already fires on
status changes); the policy collapses to `publicly_listed or (is_public and
is_featured) or owner`, and the `vault_images` policies collapse to one.

Other RLS notes: `profiles_update_access` (`20261002081506`) calls
`private.current_profile()` ~17 times without `(select …)` (write path, low);
bare `auth.uid()` added after the July sweep on `saved_searches`
(`20260726065829:23-32`), `card_scans` (`20260729214813`), and admin EXISTS
policies on `business_affiliate_links`, `shop_categories`, `promo_codes`,
`promo_code_redemptions`, `blog_article_topics`, `event_scan_*`,
`event_source_watches` (planner runs these once; advisor noise). `events`
still carries 15 permissive policies.

### 5.3 Missing indexes for current query shapes

Postgres 17 here: a two-value `IN` on the leading column cannot use the order
of a `(status, created_at)` index, which is why several rows below suggest
partial indexes. Verify against `pg_indexes` first — the core tables predate
the migrations directory and some single-column FK indexes are inferred.

| Query (site) | Covered today | Suggested |
|---|---|---|
| listings by seller, newest first (`PublicSellerProfilePage.jsx:52`, `SoleTraderStorePage.jsx:96`, `MoreFromSeller.jsx:21`, `account/AccountListings.jsx:109`, prerender; also the monthly-quota trigger `20260802060100:67-70` on every listing INSERT) | FK idx only | `listings (seller_id, created_at desc)` |
| listings by vault item + status (`ProductDetailPage.jsx:248`, `CheckoutPage.jsx:172`, `MyVaultPage.jsx:87`, `VaultListingModal.jsx:118`, the RLS probes above) | FK idx only | `listings (vault_item_id, status)` |
| active+sold, newest (`SearchResultsPage.jsx:61`, `CollectionPage.jsx:575`, marketplace with sold) | composite exists but the 2-value IN sorts | partial `listings (created_at desc) where status in ('active','sold')` |
| just-sold ticker (`LiveActivityTicker.jsx:57`) | none | partial `listings (updated_at desc) where status = 'sold'` |
| vault_items by owner, newest (`MyVaultPage.jsx:69`, `account/AccountVault.jsx:71`, `VaultProfilePage.jsx:70`, `src/routes/vault.js:29`) | FK idx only | `vault_items (owner_id, created_at desc)` |
| Holy Grail (`CollectionPage.jsx:499,525`) | none | partial `vault_items (estimated_value_aud desc) where is_public and estimated_value_aud > 0` |
| notifications list (`hooks/useNotifications.js:29`) | leading column only | `notifications (user_id, created_at desc)` |
| notifications dedupe in the order trigger / `pendingOrderAlertService.js:103` | none | partial `notifications (related_id, type) where related_id is not null` |
| orders by buyer/seller (`account/AccountOrders.jsx:418`, `TransactionHistoryPage.jsx:22`, `purchaseVelocity.js:67`) | `orders_seller_id_idx` | `orders (buyer_id, created_at desc)`, `orders (seller_id, created_at desc)` |
| guest velocity (`purchaseVelocity.js:75`) / webhook by PaymentIntent (`stripeWebhookService.js:1056`) | none | partial on `buyer_email`, partial on `stripe_payment_intent_id` |
| upcoming approved events (`CommunityEventsPage.jsx:97`, `LocalMapPage.jsx:217`, `RelatedEvents.jsx:16`, sitemap, prerender) | none | partial `events (start_date) where status = 'approved'`; plus `events (slug)` |
| watchlist count per listing (`src/routes/listing-stats.js:19`) | unique leads with `user_id` | `watchlist (listing_id)` |
| admin fan-out `profiles where is_admin` (~12 backend sites) | none | partial `profiles (id) where is_admin` |
| featured sellers (`lib/homepageData.js:82`) | `idx_profiles_featured_sellers` is partial on `is_featured_seller`; the OR on `subscription_tier` makes it unusable | partial `profiles (rating desc nulls last) where is_active and (is_featured_seller or subscription_tier = 'ultimate')` |
| marketplace free-text (`src/utils/cardSearchFilter.js:7,26`) | `card_name`/`set_name` trgm exist, but the OR includes `card_number`, so the BitmapOr can't use them | gin trgm on `vault_items (card_number)` and `(variant)` |
| events site search (`SearchResultsPage.jsx:141`) | `title` trgm only | gin trgm on `events (suburb)` |
| `card_catalogue`, `market_data`, `shop_affiliate_products` `ilike('%x%')` | btree only | gin trgm |

`ILIKE` against expression indexes never matches: `partners.code`
(`promoCodeService.js:337`, checkout path), `launch_registrations.email`,
`shop_products.sku` lookups all seq-scan. Store normalised and use `eq`.

### 5.4 Triggers and fan-out

- A listing INSERT runs four BEFORE triggers, an AFTER trigger and two
  restrictive WITH CHECK policies (~6 extra queries): approval settings,
  banned-word scan over the full `to_jsonb(vault_items)` row, the monthly quota
  `count(*)` (needs the seller index above), then an UPDATE of `vault_items`
  that fires its own lock trigger and a full-row WAL write to realtime.
  Worth checking: when the vault item is `locked`, that sync UPDATE runs as the
  seller and `trg_fn_vault_enforce_item_lock` (`20260823060200:41`) raises, so
  the listing change fails.
- `award_points_on_order_completed` (`20260823060000`) fires on every `orders`
  UPDATE and filters inside the body; make it `after update of status`.
- `notifications_push_dispatch` (`20260823053100:28-37`) makes one pg_net HTTP
  call per inserted notification row, and admin broadcasts insert one row per
  admin (`stripeWebhookService.js:102,182,223,268,629`), each calling back into
  `/api/push/dispatch`. Batch via a statement-level trigger.
- `event_rsvp_counts` is an unfiltered GROUP BY view with `security_invoker =
  false`; fine for `event_id = X`, a full aggregate for `.in()` reads.

### 5.5 pg_cron

Job 1 posts to the `stripe-worker` edge function **every minute** (97,904
runs since 1 Aug; 51,448 `net.http_post` calls in the statistics window). It
is the Stripe Sync Engine's queue drain. With a handful of Stripe events a day
this is almost entirely empty runs; every 5 minutes would cut the pg_net
traffic and edge-function invocations by 80 % with no user-visible change
(webhooks still arrive in real time — the worker only reconciles). Confirm
against `docs/stripe-sync.md` before changing it.

---

## 6. Backend and API

### 6.1 Per-request cost (High)

- **Auth round-trip per request.** `src/middleware/auth.js:24`, `:52` and
  `src/middleware/supabase-auth.js:11` each call `supabase.auth.getUser(token)`
  (a network call to GoTrue). Several routes run it twice in one request:
  `routes/event-scraper.js:37` + `:49/:78/:196`, `routes/seller-ratings.js:15` +
  `:21/:89/:189`, `routes/cardsight.js:25` + `:39`. `requireAal2.js:55` adds
  `auth.admin.mfa.listFactors` per admin request, and `isAdminUser` re-queries
  `profiles` after `requireAdmin` in ~10 routers. Fix: verify the JWT locally
  (`getClaims()`/JWKS) with a short LRU keyed on the token hash capped at
  `exp`; memoise `isAdmin` on `req`; mirror `is_admin` into `app_metadata`.
- **Checkout pricing is ~15 + 5N sequential round-trips per cart.**
  `src/services/commissionService.js:4-11` reads one `platform_settings` key
  per call (copies at `stripeWebhookService.js:71`, `refundAmounts.js:16-37`,
  `adminNotificationRecipient.js:22`); `cartService.js:56-203` awaits each cart
  line's row and re-reads the same settings and `fee_config` per line. Runs on
  `/stripe/calculate-cart` (a live preview) and `/create-cart-checkout`.
  Fix: one `getPlatformSettings([...keys])` with a 30–60 s in-memory cache,
  batch-fetch cart rows with `.in('id')`, compute commission once per seller
  tier.
- **`noCacheHeaders` is mounted on the whole API** (`src/app.js:148-150`), so
  identical-for-everyone GETs are uncacheable at Cloudflare/Vercel:
  `/ebay/popular-cards`, `/points/leaderboard`, `/categories`, `/subcategories`,
  anonymous `/recommendations`, `/search-suggestions`, `/catalog/*`,
  `/psa/cert/:n`, `/seller-ratings/:id`, `/listing-stats/:id/watchers`,
  `/vault/public`. Only `settings.js:68` overrides it. Add a `publicCache()`
  helper mirroring that override.
- `app.js:127` builds `express.json({ limit })` inside the per-request wrapper;
  `app.js:147-150` mounts the same router at `/`, `/hcgi/api` and `/api`, so
  production `/api/*` requests walk ~110 layers under `/` first;
  `morgan('combined')` duplicates Vercel's request log; `ebayCache` logs every
  HIT/SET at debug with no level filter.

### 6.2 Outbound calls

- **No timeout**: `utils/ebayClient.js:71,32` (every eBay path including the
  price cron), `utils/addressValidation.js:116` (checkout critical path),
  `utils/turnstile.js:42`, `utils/recaptcha.js:37`, `utils/newsletter.js:26`,
  `routes/auth/password.js:52` (HIBP), `utils/exchangeRates.js:159`,
  `utils/paypalClient.js:33-116`, `psaApiClient.js:36,95` (×3 attempts),
  `psaScraper.js:23`, `src/api/integrated-ai.js:191,239`. Anthropic clients use
  the SDK's 10-minute default with 2 retries; Stripe the 80 s default. Fix:
  `AbortSignal.timeout(...)` everywhere, `new Anthropic({ timeout, maxRetries })`,
  `new Stripe(key, { timeout: 20000 })`.
- `utils/ebayMarketData.js:207-210` runs five collections in series, each with
  3 attempts and backoff, using the in-memory cache only (`getTiered` never
  used here). `Promise.allSettled` + `getTiered`.
- eBay OAuth tokens aren't de-duplicated in flight (`ebayClient.js:14-50`): a
  cold `/ebay/popular-cards` fires 16 token requests. PayPal fetches a new
  token on every call (`paypalClient.js:26-48`).
- Uncached: `/ebay/listings`, `/catalog/pricing`, `/catalog/autocomplete` and
  `/catalog/search` (three upstream fan-outs per keystroke), all CardSight GETs
  (paid API), `/psa/cert` (immutable data).
- `src/api/integrated-ai.js:377` loads the user's entire `ai_messages` history
  with no limit and sends all of it upstream on every call.

### 6.3 Cold start

Measured: 820–860 ms to import `src/app.js`. Contributors still eager:
- Anthropic SDK via `routes/blog.js:5`, `routes/event-scan.js:8` (only needs
  `WATCHED_FIELDS`), `routes/shop-supplier-watch.js:3` and `routes/admin.js:17`
  → `supplierPrice.js:10`. Dynamic-import inside the `anthropic()` factories.
- `cardsightai` via `routes/cardsight.js:9`, `utils/cardsightRanking.js:9`,
  `utils/cardSightClient.js:3`.
- `@sentry/node` initialises OpenTelemetry at `app.js:49` with
  `tracesSampleRate: 0.2`; because ESM hoists imports, `express` is already
  loaded before `Sentry.init`, so Express auto-instrumentation is probably not
  active — the load cost is paid for little tracing. Init via `--import` or
  set `tracesSampleRate: 0`.
- `vercel.json:9` `includeFiles: node_modules/@img/**` ships ~46 MB, ~28 MB of
  which (musl + wasm sharp builds) cannot run on Vercel. Narrow to
  `node_modules/@img/{sharp-linux-x64,sharp-libvips-linux-x64}/**`.
- `cheerio` is lazy-imported but still bundled (2.4 MB with its encoding
  stack); `undici` (1.3 MB) is the deliberate SSRF-safe dispatcher.

### 6.4 Lists and loops

- Unbounded: `routes/wishlist.js:26`, `routes/buyer-protection.js:26`,
  `routes/seller-ratings.js:44-48` (every rating with reviewer joins, stats in
  JS), `routes/points.js:29` (sums the whole ledger in JS),
  `cardPriceSnapshots.js:134-137` (`tracked_cards` with no `.range()`, silently
  capped at 1,000).
- Over-selecting: `routes/vault.js:29,77` (`select('*', count exact)`, maps 8
  columns, anonymous), `routes/recommendations.js:24-140`
  (`vault_items(*, vault_images(*))` on the anonymous home and product pages,
  sequential wishlist/orders queries), `routes/price-history.js:19-25` (no cap
  on `days`, `select('*')`, plus an unrelated 50-listing query at `:113-117`).
- `services/dataDeletionService.js:48-49` pages `auth.admin.listUsers` up to
  20 × 1,000 per Facebook callback; use an RPC on `auth.identities`.
- `stripeWebhookService.js:646` inserts one notification per seller in a loop;
  `profiles where is_admin` is re-queried at `:94,180,221,266,627`; emails and
  the admin notice are awaited before Stripe gets its 200.
- `walletService.js:18-33` and `:74-84` repeat the same profile read and
  `customers.retrieve` in one request.
- `routes/search-suggestions.js:36,50`: two independent queries in series per
  keystroke; on a miss, 500 `card_name` rows are pulled for "did you mean".

---

## 7. Scheduled jobs and recurring cost

The cron runner (`.github/workflows/cron-job.yml`) is a single curl step with
no checkout or install — correct. Each run still bills a whole minute, and a
failing run with `attempts: 2` bills up to three.

| Job | Schedule | Bounded? | Minutes/month |
|---|---|---|---|
| reconcile-pending | every 2 h | 200-order cap, **no age cutoff, no "checked" stamp**; already-alerted orders filtered *after* the Stripe calls (`pendingOrderAlertService.js:55-62,122`) | **360** |
| blog-generate | daily | 1 article; 1–2 Opus calls, ~$0.40–0.80 a run | 30 (up to 6 min each) |
| event-watch, prices-refresh, delivery-sweep, supplier-watch, site-traffic | daily | yes (deadlines, limits, stamps) | 150 |
| retention-sweep | daily | **no time budget** across six sub-jobs; N+1 per row | 30 |
| event-scan | weekly | yes | 4 |
| git-backup, migration-drift | daily | run even when nothing changed; drift job installs the CLI each time | 60 |

- **Move the curl-only schedules off Actions** (Cloudflare Worker cron or
  `pg_cron` + `pg_net`, both already in use) — that removes ~650 minutes a
  month entirely. Short of that: restrict reconcile-pending to orders from the
  last 48 h and skip already-notified rows before calling Stripe; collapse the
  six daily jobs into one workflow run (~150 minutes saved).
- **Retention sweep starvation** (`retentionSweepService.js`): `watchlistAlerts`
  `.limit(300)` with no order and no "already alerted" filter (`:141-145`) so
  the same 300 rows are re-read daily and later rows never reached;
  `restockAlerts` never stamps requests whose product is still sold out
  (`:236,244`); `abandonedCheckouts` doesn't stamp skipped rows (`:108,114`);
  `savedSearchAlerts` runs a listing search per saved search every day and
  always writes `last_alerted_at` (`:179-209`). Add a deadline (the delivery
  sweep has one), terminal-row filters, ordering + a cursor, batched
  `profiles`/`notification_preferences` lookups.
- Supplier watch: archived products are filtered after the 200-row limit and
  never stamped, so they can permanently occupy the slots
  (`supplierPriceWatchService.js:42-52`).
- Site-traffic re-upserts the whole GA4 history nightly
  (`siteTrafficService.js:110-116`) and fails every day (billed) until the GA4
  env vars exist.
- **Model choice**: `blogArticleGenerator.js:17` and `eventScanner.js:36` use
  `claude-opus-5` ($5/$25 per Mtok); `claude-opus-5-5` is $4/$20 and newer. No
  `cache_control` anywhere, so the ~13 KB blog system prompt is re-sent on the
  retry. Nothing caps the backlog of unreviewed drafts (`storeArticle`, `:228`).
  Supplier price reading and event-page extraction (`supplierPrice.js:142`,
  `eventScanner.js:351`) are well-defined extraction tasks worth trialling on
  Sonnet/Haiku 5.5.
- CI: each PR push installs and builds twice (`ci.yml` and `e2e.yml`'s
  `webServer`) plus a Vercel preview build; `main-ci.yml` repeats everything on
  merge and `snyk-security.yml` adds another `npm ci` per push. Build once,
  upload `dist/`, run e2e against it; drop the Snyk push trigger.

---

## 8. Images, storage and the edge

- **Service worker treats videos as images (High).** `isStorageImage`
  (`public/sw.js:208-209`) matches every `/storage/v1/object/public/` path, so
  card clips (`.mp4`, up to 20 MB) go through `imageCacheFirst` (`:258-315`):
  rewritten onto the image CDN (which `publicVideoUrl` deliberately avoids),
  fetched whole with the `Range` header dropped (breaks Safari playback),
  stored in the 500-entry image cache and copied into R2. Exclude video
  extensions or return early on a `Range` request.
- **No negative caching in the CDN worker** (`cloudflare/image-proxy-worker.js:146-147,297,300`):
  an R2 miss falls through to Supabase every time and 404s aren't cached.
  Thumbnails are *inferred* from the upload timestamp (`utils/imageUrl.js:244-256`)
  and the thumb upload is best-effort (`AddEditCardPage.jsx:1224-1238`), so
  every card whose thumb failed costs an R2 read + a Supabase request on every
  grid view forever. Cache 404s for a few minutes.
- If image transforms are ever enabled: resize requests bypass R2 and the
  worker doesn't forward `Accept`, so Supabase never negotiates WebP/AVIF
  (`:297`). Off today, so no cost yet.
- `src/api/integrated-ai.js:170`: AI-chat and grade-estimator uploads are
  stored forever in a public bucket and fetched back by the model provider via
  public URL (egress twice). Send base64 or delete after the call. No
  `.remove()` exists for `vault-images` anywhere, so replaced photos and
  abandoned drafts accumulate (and their R2 copies).
- Uncompressed uploads: `SubcategoryManagementPage.jsx:146`,
  `ProductLinesManagementPage.jsx:137`.
- `sw.js`: `cacheFirst` (`:177-188`) re-fetches content-hashed `/assets/*` in
  the background on every hit and runs a full `trimCache` key listing per
  write; the `PAGES` cache is never trimmed; the image cache is capped by count
  (500 ≈ 100 MB), not bytes.
- `vercel.json`: `og-image.jpg` (207 KB), `pwa-icon-*.png` (90 KB),
  `manifest.json`, `robots.txt`, `llms.txt`, `openapi.json` are served with
  `max-age=0`, so Cloudflare never caches them either; the `/assets`, `/images`,
  `.woff2` and favicon header blocks at `:425-472` are dead duplicates of
  `:631-678`; the CSP is duplicated in full. `installCommand` is `npm install`,
  not `npm ci`.
- **Possible cache override (verify)**: the catch-all `/(.*)` header
  (`vercel.json:578-583`) sets `Cache-Control: public, max-age=0,
  must-revalidate` on every path. If Vercel applies it over the function's own
  header, the `s-maxage=3600` set by `api/prerender.js:3517` and
  `api/sitemap.js:194` (and `settings.js:68`) never reaches the CDN and every
  bot hit runs the function. Check with
  `curl -sI -A Googlebot https://cardpop.com.au/marketplace` and
  `curl -sI https://cardpop.com.au/sitemap.xml`. The sitemap scans up to ~37
  paged queries (10k listings with a join, 10k profiles filtered in JS) per
  miss. The bot UA pattern is copied 31 times and includes `bot|crawler|spider`
  (every SEO scraper) and `chrome-lighthouse` (so Lighthouse CI measures the
  bot HTML, not the app).

---

## 9. Third-party scripts and dependencies

- Three analytics systems record every page view: GA4, Cloudflare Web
  Analytics and Vercel Web Analytics, plus Speed Insights with no sample rate,
  all including `/admin`. Keep GA4; drop one of the others; sample Speed
  Insights; skip admin.
- The Impact affiliate tag runs `transformLinks`/`trackImpression` on every
  page including checkout, account, admin and messaging (`main.jsx:236-244`).
  Gate it like AdSense.
- The reviews badge still loads on `/account`, `/vault`, `/messaging`, `/scan`
  (`lib/googleCustomerReviews.js:151-155`).
- Browser Sentry traces at 20 % of page views; 5 % would be plenty.
- **Dependencies**: `@supabase/supabase-js` is in `devDependencies`
  (`package.json:113`) but is a runtime import on the server
  (`src/utils/supabaseClient.js`, `api/sitemap.js`) — it only works because
  Vercel installs dev dependencies. `tailwindcss-animate` belongs in
  devDependencies; `terser` is unused. Fourteen packages are imported only by
  unused shadcn wrappers (`@radix-ui/react-aspect-ratio`, `-avatar`,
  `-collapsible`, `-context-menu`, `-hover-card`, `-menubar`,
  `-navigation-menu`, `-toggle-group`, `-toggle`, `-toast`, `react-day-picker`,
  `embla-carousel-react`, `input-otp`, `react-resizable-panels`, `vaul`); 27
  `components/ui/*.jsx` wrappers are unused. `next-themes` is imported but no
  `ThemeProvider` is mounted. The Radix toast chain (`components/ui/toast.jsx`,
  `toaster.jsx`, `hooks/use-toast.js`, fed by `hooks/use-integrated-ai.jsx`)
  renders nothing. Install-time cost only, on every CI and Vercel build.

---

## 10. Status of the July 2026 audit

Fixed since: H1 (WatchlistProvider), H2 (card column constants), H3/H4/M4/M6/M7/M9
(index migration `20260724013206`, dead SQL file removed), H6 (sharp lazy),
H7 (tiered cache for `/ebay/search`, `/price-estimate`, `/popular-cards`),
M1 (memoised context values), M2/M3 (payload-applied realtime updates),
M10 (lazy Stripe and cheerio), L7.

Still open: **H5** (`count: 'exact'` on public grids — `ShopCategoryPage.jsx:107`
plus 30 other sites, now compounded by the homepage's four counts), **M5**
(auth round-trip per request, §6.1), **M8** (marketplace grouping memoisation),
**M11** (search suggestions serial + uncached), **L1** (vault product
waterfall), **L2** (recommendations over-select), **L3** (dead toast system),
**L5** (duplicate `vercel.json` headers), **L8** (Header 500 ms interval).

---

## 11. Suggested execution order

1. **Realtime discipline** (§4.2) — one day. No channels for anonymous
   visitors, a `NotificationsProvider`, fix the product-page re-subscribe,
   filter the watchlist and dashboard bindings. Largest DB-time win on the
   project today and fixes two live bugs.
2. **App shell for every route** (§3.1) — one to two days. Reuse
   `homeShellPlugin` for `app.html` with the shared header; then per-route
   skeletons for marketplace and shop. Largest user-facing win: non-home FCP
   from ~2.5 s to ~0.9 s.
3. **Auth refocus + per-request auth** (§4.1, §6.1) — one day. Skip no-op auth
   events and key effects on the user id; local JWT verification with a short
   cache; one batched settings read for checkout.
4. **Bounded, narrow reads** (§4.3) — one to two days. Paginate `/collections`,
   `/events` and the blog index with explicit columns; `LISTING_CARD_COLUMNS`,
   `SHOP_CARD_COLUMNS`, `PROFILE_CARD_COLUMNS`; thumbnails on the collection
   strips; homepage counts from a summary row.
5. **One migration** (§5) — half a day. `publicly_listed` flag + collapsed
   `vault_items`/`vault_images` policies, the composite/partial indexes above,
   the two duplicate-index drops, `award_points_on_order_completed` on
   `update of status`, batched push dispatch.
6. **Scheduled cost** (§7) — half a day. Reconcile-pending age cutoff and
   "already notified" filter; one daily workflow; retention sweep deadline and
   cursors; Opus 5 → 5.5; pg_cron Stripe worker to every 5 minutes.
7. **Edge and service worker** (§8) — half a day. Video exclusion, negative
   caching in the worker, long cache for the unhashed public files, remove the
   dead header blocks, verify the `/(.*)` override with the two curl commands.
8. **Cold start and outbound hygiene** (§6.2–6.3) — one day. Timeouts on every
   outbound call, lazy Anthropic/cardsightai, narrowed `includeFiles`, Sentry
   tracing decision.
9. **Housekeeping** — dependency moves and removals, dead toast chain, Header
   interval, memoised grid cards, `check-bundle-size` for `app.html`.

Items 1, 4, 6 and 7 carry no user-visible risk. Item 2 changes what every
route paints first and should go through a preview deployment and a PSI run
on `/marketplace` and `/shop` before merging.
