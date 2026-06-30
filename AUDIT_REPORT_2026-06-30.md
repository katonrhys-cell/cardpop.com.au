# CardPop Deep Site Optimisation & Bug Audit — 2026-06-30

Branch: `claude/site-optimization-audit-9qx3rh`

A second deep audit across the whole codebase (~70k LOC: 132 pages, 179
components, 38 backend routes, 31 hooks, 4 contexts), run as **seven parallel
domain sweeps** (backend auth/security, backend payments/integrations,
marketplace/shop/cart FE, account/vault/trade FE, admin FE, shared
infra, perf/SEO/a11y), plus a focused pass on the production **PageSpeed
Insights** data the owner supplied (mobile FCP 3.3s / LCP 4.9s on Slow 4G;
desktop Perf 100). Every finding was re-verified against the actual code before
any change. Findings already fixed in the prior `AUDIT_REPORT.md` are excluded.

Baseline at start: lint clean, `npm test` = 1520 passed / 3 skipped.
After fixes: lint clean, **1522 passed / 3 skipped**, build + bundle gate pass.

Legend: ✅ fixed this branch · ⏸️ deferred (needs a decision or DB migration) ·
🔎 needs runtime/DB confirmation before fixing.

---

## ✅ Fixed — Mobile performance & SEO (from production PageSpeed)

Commit: *“Audit batch 1”*

| Area | Issue | Fix |
|---|---|---|
| SEO — canonical | Lighthouse: "multiple conflicting rel=canonical (cardpop.com.au vs www.cardpop.com.au)". `SEOHead` fell back to `window.location.href`, so the www host produced a www canonical that conflicted with the static apex one in `index.html`. | `SEOHead` now emits an **apex-normalised, query-stripped** canonical; removed the static `<link rel=canonical>` from `index.html`; added a **www→apex 301 redirect** in `vercel.json` so www never serves a rival page. |
| Perf — preconnect | Lighthouse: ">4 preconnect connections". `index.html` had 6 hints incl. duplicated font preconnects and a useless self-preconnect. | Reduced to 3 (`fonts.googleapis`, `fonts.gstatic`, Supabase). Added a Supabase preconnect to speed the first data fetch. |
| Perf — payload | ~3 MB of unreferenced image masters (`public/images/originals/`, `hero/og.jpg`) shipped to the CDN; dead `public/.htaccess` (Apache, meaningless on Vercel). | Deleted (verified zero code references; served hero images are the `-360/-720` variants). |
| Perf — caching/offline | Service worker precached dev-only paths (`/main.jsx`, `/index.css`) that 404 in prod; `cache.addAll` is atomic so **nothing** precached. | Precache only the app shell (`/`, `/index.html`); hashed assets cache on demand. Bumped cache to `v3`. |
| Agentic Browsing | "llms.txt does not follow recommendations". File had no H1/summary; the generator's `routes.size` check was written as `.length` (always undefined → guessed URLs); titles carried JSX artefacts. | Generator now emits a spec-compliant `# CardPop` H1 + summary blockquote + absolute URLs; fixed the Map `.size` bug and title cleaning. |

> Remaining PageSpeed items are code-splitting / CDN-shaped (see ⏸️ Performance below): unused JS (133 KiB), unused CSS (25 KiB), enormous payloads (5.9 MB desktop), efficient cache lifetimes (4.1 MB — largely third-party: GTM, Impact, Supabase images), legacy JS (11 KiB), image delivery (180 KiB). Mobile FCP/LCP is gated by the empty `#root` waiting on the entry JS; the highest-leverage next step is trimming `select('*')` over-fetch (PERF-3) and paginating the marketplace grid (PERF-2).

## ✅ Fixed — Money-flow security (backend)

Commit: *“Audit batch 1”*

| Sev | Area | Bug | Fix |
|---|---|---|---|
| CRITICAL | `services/refundService.js`, `routes/admin.js` | Refund amount & retained fee were computed from the **buyer-created** `refunds` row. A buyer who set `commission_aud`/`gst_aud` to 0 escaped the ~50% fee retention (full refund, platform retains nothing). | Compute from the server-authoritative `orders` row (`total_aud` / `platform_fee_aud`) in **both** the admin approve path and the Stripe-processing path; assert `refundAmount <= orderTotal`. |
| HIGH | `services/refundService.js` | A manual refund could run on an order whose payout was already `frozen`/`reversed` by a chargeback → double-acts (re-reverses payout, double-compensates buyer). | Refuse to process when `order.payout_status ∈ {frozen, reversed}`. |
| HIGH | `services/checkoutService.js` | `transactionType` was trusted from the request body → a buyer could pass `'trade'` to get a 0% commission tier on a normal fixed-price purchase. | Derive it server-side from context (`offerId`→offer, `bidId`→auction, else fixed); ignore the client value. |
| HIGH | `routes/auth/login.js` | `/record-success` cleared the brute-force lockout for `(email, ip)` with **just an email** — anyone could reset a victim's (or their own) lockout. | Require a valid Supabase session token matching the email before clearing. |
| MEDIUM | `routes/ebay.js` | Hardcoded `USD_TO_AUD = 1.50` skewed every cross-marketplace average feeding card valuations. | Use the live (24h-cached) `getUsdToAudRate()` with its safe fallback. |
| MEDIUM | `routes/auth/mfa.js` | `/mfa/request` had no per-user rate limit → OTP-email / `mfa_sessions` flooding. | New `mfaRequestLimiter` (5 / 15 min per user), separate bucket from verify. |
| LOW | `routes/vault.js` | `PATCH /vault/:id/base-value` rejected a legitimate value of `0` (`!newValue`). | Accept `0`; reject only null/NaN/negative. |

## ✅ Fixed — Critical / high frontend correctness

Commits: *“Audit batch 1” & “Audit batch 2”*

| Sev | File | Bug | Fix |
|---|---|---|---|
| CRITICAL | `pages/marketplace/MarketplaceListingPage.jsx` | Read `listing.price` (column is `price_aud`) and misused `formatCurrency` → **blank price on every listing** + a priceless Product/Offer schema. | Render `$${price_aud}`; pass `price_aud` into structured data. |
| CRITICAL | `pages/account/AccountOrders.jsx` | `fetchOrders` was never called on mount → "My Orders" stuck on skeletons for **every** user. | Add a mount effect; make the fetch error-safe. |
| CRITICAL | `utils/categoryMappingEngine.js` | Bulk auto-mapper ignored each update's `{error}` (false "Successfully mapped N") and crashed the batch on a null category name. | Check the update error per row; null-guard the category name. |
| HIGH | `components/Header.jsx` | Notification realtime subscriptions were **unfiltered** — every platform-wide message/trade woke every client into a double count-refetch. | Scope subscriptions to the user's rows + per-user channel names. |
| HIGH | `pages/BrowseListingsPage.jsx` | Add-to-cart read `product.price`/`product.name` (wrong columns) → $0.00 cart lines, blank titles, and a `?q=` search on a non-existent `name` column that errored the grid. | Use `price_aud`, the `title` column (card_name fallback), search `title`, cap a 1-of-1 listing at qty 1. |
| MEDIUM | `pages/account/AccountVerification.jsx` | `STATUS_CONFIG[status].icon` white-screened on an unmapped `verification_status`. | Fall back to the `none` config. |
| MEDIUM | `contexts/AdminContext.jsx`, `contexts/CategoryContext.jsx` | Provider values were unmemoised object literals → app-wide re-render storms (completes the sweep started on AccountContext/CartContext). | `useMemo` the value; `useCallback` `logAdminAction`. |
| MEDIUM | `pages/shop/ShopSinglesPage.jsx`, `ShopSealedBoxesPage.jsx` | "Clear Filters" set sort to `'-created'`, matching no Select option → the Sort control blanked. | Reset to `'created_at_desc'`. |
| MEDIUM | `pages/grading/GradingROIPage.jsx` | Gem + Grade-9 sliders allowed >100% combined probability → inflated expected revenue/ROI verdict. | Scale the two rates down proportionally when they exceed 100%. |
| MEDIUM | `pages/admin/AnalyticsReportsPage.jsx` | Money formatted as `en-US`/USD on an AUD platform. | Format as `en-AU`/AUD. |

---

## ⏸️ Deferred — verified, not yet fixed

Grouped by area, most-impactful first. Each was confirmed in code; the reason it
is deferred (decision, DB migration, schema confirmation, or larger refactor) is
noted.

### Frontend — user-facing breakage

- **CRITICAL `pages/community/LocalMapPage.jsx`** — the retailer map layer selects/filters `business_name, store_address, store_suburb, …` which **don't exist** on `business_profiles` (canonical: `brand_name, logo_url, affiliate_link, …`, and the table has no geo fields at all). Retailer markers never render. *Needs a schema decision (which table holds physical-store geo) before it can work.*
- **HIGH `components/VaultListingModal.jsx` + `pages/vault/VaultCategoryPage.jsx`** — "For Sale & Trade" writes `listings.listing_type = 'fixed'`, identical to sale-only, so the "For Trade" filter (`.eq('listing_type','trade')`) never returns dual-mode listings. *Needs a DB enum value (e.g. `'sale_trade'`) or an `accepts_trade` boolean.*
- **HIGH `pages/vault/VaultCategoryPage.jsx`** — selects `profiles:owner_id(name)` (no `name` column) and has an **empty `catch`**; seller info renders blank and a failed query shows a false-empty grid. The "All" branch also has no `is_public`/active-listing filter (leaks private vault items) and ignores the listings `{error}`. *Fix = select `display_name, username, avatar_url, is_verified, rating`; check errors; restrict to public listings.*
- **HIGH `pages/blog/BlogPage.jsx` / `BlogArticlePage.jsx`** — three disjoint category taxonomies (BlogPage slugs vs labels vs BlogArticlePage VALID_CATEGORIES); "Explore by Topic" filters by a slug that never equals a stored category → "No articles" on every category page. *Needs the taxonomies reconciled (confirm actual `category` values first).*
- **HIGH (cluster)** community/blog primary fetches that ignore `{error}` → outages render as cheerful empty states: `CommunityPage.jsx`, `ForumPage.jsx`, `ProfilesPage.jsx`, `RetailersPage.jsx`, `LocalTradersPage.jsx`, `BlogPage.jsx`. *Mechanical `if (error) throw error` + error UI.*
- **MEDIUM `pages/grading/GradeEstimatorPage.jsx`** — `estimate.toFixed()` / subgrade `.toFixed()` on un-validated model JSON → TypeError white-screen on a string/missing grade. *Guard with `Number.isFinite`.*
- **MEDIUM** `pages/account/AccountNotificationSettings.jsx` (save ignores upsert error → false "saved"; load throws uncaught → permanent "Loading…") and `AccountDashboard.jsx` (empty `forEach`, per-query `.error` ignored → false zeros). *Mechanical error checks.*
- **MEDIUM `pages/community/WhatnotShowsPage.jsx`** — `URL.createObjectURL` preview never revoked (leaks the Blob per image select). *Revoke on replace/clear/unmount.*
- **MEDIUM `pages/shop/ShopSinglesPage.jsx`/`ShopSealedBoxesPage.jsx`** — the "Condition" filter is in the effect deps but never applied to the query (dead control). *Confirm `shop_products.condition` exists, then `.eq('condition', …)`.* (Not applied here to avoid erroring the grid on an unconfirmed column.)
- **LOW** error-swallow / UX: `AccountWallet/Events/Reviews` (false "$0", empty catches, `.single()` vs `.maybeSingle()`); `ContactPage` reports success even when no mail client opens; `ForumPage`/`LocalTradersPage` type-ahead lack out-of-order guards; blog dead reply/view counters and raw-HTML excerpt truncation.
- **Confirmed still-open from prior audit:** `PublicCollectionsPage` (`id.charCodeAt(1)`→NaN series; reads non-existent `listingStatus`); `VaultProfilePage` camelCase fields; `components/UserDetailModal.jsx` (dead, writes non-existent columns); `hooks/use-integrated-ai.jsx:274` object-URL leak (the `GradeEstimatorPage` leak does **not** reproduce — it already revokes).

### Frontend — shop add-to-cart (coupled, needs a product decision)

- **HIGH `components/ProductCard.jsx`** — destructures only `({ product })`, ignoring the `onAddToCart` prop the shop pages pass, so `/shop`, `/shop/singles`, `/shop/sealed` grids have **no add-to-cart button**. *Decision: add a grid button, or remove the dead handlers.*
- **MEDIUM** shop list pages read `product.stockQuantity` (camelCase; column is `stock_quantity`) → no stock cap / wrong cap of 1. *Latent until the button above is wired; fix together.*
- **PLAUSIBLE `pages/marketplace/MarketplacePage.jsx`** — Rookie-Cards filter uses `.contains('vault_items.cardVariants', …)` (embedded-array contains; may be unsupported / wrong column) → could error the grid. *Verify against the live DB.*

### Admin

- **HIGH `pages/admin/UserDetailPage.jsx` + `components/admin/UserActionsModal.jsx`** — Suspend/Ban/Reset-password/Delete are **no-ops**: the page passes `onComplete` but the modal calls `onConfirm`, `ACTION_LABELS` lacks `suspend`/`unsuspend`, and there is no mutation. *Delete needs a service-role backend endpoint; the rest need wiring.*
- **HIGH `pages/admin/OrderManagementPage.jsx`** — refund-review dialog ignores `{error}` on the `refunds` read → a real failure shows "No refund details found" (masks the error).
- **MEDIUM (cluster)** admin reads/writes/uploads swallowing `{error}`: `SubcategoryManagementPage`, `ProductLinesManagementPage` (reads + `if (!upErr)` image-upload), `EventFormModal` image upload, `AdminDashboard`, `AnalyticsReportsPage` stats, `UserManagementPage` related counts, `FeaturedCardsAdminPage` read.
- **MEDIUM** reorder-by-`sort_order`: `CollectionsManagementPage` (`+ direction` on one row, never swaps the neighbour, ignores error — worst); `HeroShowcaseAdminPage` / `CollectionSectionsAdminPage` (swap fails when both rows share `sort_order`). *Add a stable tiebreaker + swap by index + check error.*
- **PLAUSIBLE `pages/admin/AdminSettingsPage.jsx`** — boolean settings may not round-trip (`!!"false"` is true) and every save upserts all 16 keys (materialises defaults). *Depends on the `platform_settings.value` column type.*
- **LOW** `AnalyticsReportsPage` "Export Data" button has no `onClick` (dead); `AdminVerificationDashboard` aliases `email:id` (latent); dead files `pages/admin/EventsAdminPage.jsx` + `pages/EventsAdminPage.jsx` (unreachable, divergent schema — recommend deletion).

### Backend

- **MEDIUM `routes/auth/mfa.js`** — `mfa_enabled` is decorative: a successful `/verify` sets it but nothing enforces MFA at login (Supabase issues the session independently). *Decision: enforce via Supabase AAL2 / factors, or relabel.* (Same class as the deferred sessions/devices "security theatre".)
- **MEDIUM `routes/index.js`** — the trade-protection guard is mounted **after** all feature routers and matches `/trade` as a prefix only; the CLAUDE.md claim "any path containing trade" is not what's implemented (latent — no live router defines a `trade` subpath today).
- **MEDIUM** `services/disputeService.js` / `payoutService.js` use a default `supabase` import while the rest use the named import (works today; normalise to avoid a silent future break). `utils/ebayCache.js` is an unbounded module-global Map (latent; safe while only the single `popular-cards` key is used).
- **LOW** password policy accepts `score>=4` of 5 (e.g. `Password1`); legacy CryptoJS (AES-CBC, no integrity) decrypt branch reachable for un-migrated rows; `middleware/error.js` leaks stack traces if `NODE_ENV` is unset (default `isProd` true to fail closed).

### Shared infra

- **LOW** `useTradeRequests.acceptTrade` is a non-atomic accept-then-cancel with the 2nd write's `{error}` ignored (a listing could be committed in two accepted trades); `useShopProductRealtimeSync`/`useVaultItemRealtimeSync` default to fixed channel names + unfiltered subscriptions; `useEbayPriceLookup`/`apiServerClient` don't check `response.ok`; `App.jsx` has a duplicate (dead) `/marketplace/:id/:slug?` route. *Doc drift: CLAUDE.md references `api/EcommerceApi.js`, which no longer exists.*

### Performance / SEO / A11y (optimisation backlog)

- **HIGH** `MarketplacePage` (`.limit(100)`), `MyVaultPage`, `AccountVault` render large flat card lists (no pagination/virtualization) → mobile TBT/scroll jank. *Paginate to ~24–32 or window with `react-window`.*
- **HIGH** `select('*')` with triple-wildcard nested joins on the hot list queries (`MarketplacePage`, `BrowseListingsPage`, `SearchResultsPage`) → bloated mobile payloads. *Enumerate the ~10 columns the cards read.* **This is the biggest lever on mobile LCP/TTI.**
- **MEDIUM** seller pages (`PublicSellerProfilePage`, `SellerProfilePage`, `VaultProfilePage`) run independent queries sequentially (~1s avoidable). *`Promise.all` the independent ones.*
- **MEDIUM** migrate `react-helmet` → `react-helmet-async` (unmaintained, React-18 unsafe-lifecycle warning, not concurrent-safe); drop the redundant App-level `<Helmet>` title that conflicts with `index.html`.
- **MEDIUM** admin `UserManagementPage` N+1 (2 count queries per user per page); `vite.config.js` `optimizeDeps: { include: allDeps }` force-prebundles heavy lazy deps (dev-only cost).
- **A11Y** `ImageZoomModal` has no `role="dialog"`/`aria-modal`, no focus trap/restore, unlabelled zoom range. *Swap to the Radix Dialog already in the project, or add the ARIA + trap.*
- **PageSpeed residuals** (need code-split/CDN work): unused JS 133 KiB / CSS 25 KiB, legacy JS 11 KiB, image delivery 180 KiB, cache lifetimes 4.1 MB (mostly third-party). LCP preload per route for image-LCP pages.

---

## Verification

- `npm test` (full suite): **1522 passed, 3 skipped** (was 1520/3 at start; +2 new
  `record-success` auth tests). Tests that encoded the *old buggy* behaviour were
  updated to assert the corrected behaviour (refund server-side computation,
  `record-success` auth requirement, MFA request limiter bucket).
- `npm run lint` clean; `npm run build` + `tools/check-bundle-size.js` pass
  (228.5 KB / 320 KB initial JS budget).
