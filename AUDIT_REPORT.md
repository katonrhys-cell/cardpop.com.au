# CardPop Site-Wide Bug Audit

Date: 2026-06-26
Branch: `claude/site-wide-bug-audit-8o2m1g`

A deep audit across the whole codebase (~70k LOC: 131 pages, 179 components, 37
backend routes), run as eight parallel domain sweeps (auth/sessions, payments,
other backend routes, marketplace/shop FE, account/vault/trade FE, admin FE,
shared components/hooks/lib, misc pages). Each finding below was re-verified
against the actual code before any change.

Legend: ✅ fixed in this branch · ⏸️ deferred (needs a decision or DB migration) ·
🔎 investigated, not a bug · ⚠️ pre-existing, out of scope.

---

## ✅ Fixed — Backend security (`commit: harden auth, rate-limiting and SSRF`)

| Sev | Area | Bug | Fix |
|---|---|---|---|
| CRITICAL | `utils/ipKeyGenerator.js` | Read the client-controlled `X-Forwarded-For` header, defeating the bounded `trust proxy` setting — every rate limiter & IP lockout was spoofable. | Use `req.ip` (Express-derived from the bounded hop count); never the raw header. |
| CRITICAL | `routes/auth/mfa.js` | `/verify` looked up the MFA session by `mfaId` only → IDOR (operate on another user's session); OTP never invalidated → replay; `/request` trusted a body-supplied email. | Scope lookup to `req.user.id`; reject already-verified rows; null the OTP after use; bind email to `req.user.email`; constant-time code compare. |
| HIGH | `middleware/endpoint-rate-limit.js` | `mfaLimiter` keyed on the body `mfaId` — rotate it (or omit → spoofable IP) to evade the cap. | Key on `req.user.id` (route is behind `authMiddleware`). |
| HIGH | `routes/buyer-protection.js` | `/my-claims` selected `orders.total_amount`, a column that doesn't exist (`total_aud` is used 30× elsewhere) → 500 for every user. | Select `total_aud`. |
| HIGH | `routes/event-scraper.js` | SSRF: any authenticated user could make the server fetch an arbitrary URL (cloud metadata, internal services) and read the body. | DNS-resolve and block private/loopback/link-local ranges; require admin on the fetch + AI-extract routes. |
| HIGH | `routes/search-suggestions.js` | `q` interpolated raw into a PostgREST `.or()` filter string → filter injection; `%`/`_` caused full-table scans. | Sanitize the term (strip filter-grammar + LIKE wildcards), clamp length & limit. |
| MEDIUM | `middleware/supabase-auth.js` | A thrown `getUser` was forwarded as a 500 (and leaked the message in non-prod). | Treat as unauthenticated — `next()` with no error. |
| MEDIUM | `routes/auth/backup-codes.js` | `/generate` used `update`, so a missing `user_security` row silently no-op'd (codes never saved). Non-constant-time code compare. | `upsert` keyed on `user_id`; constant-time compare. |
| MEDIUM | `utils/psaApiClient.js` | Cert number interpolated unencoded into the PSA URL path → path injection. | Validate `^[A-Za-z0-9-]+$` and `encodeURIComponent`. |
| MEDIUM | `routes/market-data.js` | `trending/limit/:limit` accepted negative/huge limits (`parseInt('-5')` is truthy). | Clamp to `[1, 50]`. |

## ✅ Fixed — Frontend critical logic (`commit: watchlist, retailers, shop filter, badges`)

| Sev | Area | Bug | Fix |
|---|---|---|---|
| CRITICAL | `hooks/useWatchlist.js` + `AccountWatchlist.jsx` | `toggle` returned the new watch-state, but the page treated it as a success flag → every *successful* removal reported "Failed to remove". Supabase `{error}` was never inspected, so rollback never fired on real failures. | Return `{ success, watchlisted }`; inspect the `{error}`; update both callers. |
| CRITICAL | `pages/InsiderTradingPage.jsx` | Admin form + retailer cards used camelCase keys against the snake_case `business_profiles` table → form could never submit, every card rendered blank with broken links. | Standardise on snake_case (`brand_name`/`logo_url`/`affiliate_link`/`is_active`); null-guard the scroll target. |
| HIGH | `pages/shop/ShopCategoryPage.jsx` | `CategoryFilter` was passed props it doesn't accept → the sort/category control was dead. Unstable object deps caused redundant refetches; page not reset on category/sort change. | Wire the filter to control sort (`price_aud`/`created_at`); depend on slug strings; reset page. |
| MEDIUM | `pages/AustralianMarketsPage.jsx` | `statsData.totalSalesVolume.toLocaleString()` crashed the stats grid when the field was absent. | `(… ?? 0).toLocaleString()`. |
| LOW | `components/ProductCard.jsx` | Grade-badge colour keyed on raw (case-sensitive) company → wrong colour for `PSA`; verified badge gated on string `'true'` only. | Lowercase the key; accept boolean `is_verified`. |

## ✅ Fixed — Admin + shared (`commit: error-checks, dead-control, re-render`)

| Sev | Area | Bug | Fix |
|---|---|---|---|
| CRITICAL | `pages/FeaturedCardsAdminPage.jsx` | Featured-toggle ignored `{error}`; on failure it mapped the row to `null` and crashed reading `.card_name`. | Check error/null and throw. |
| HIGH | `components/ModerationPanel.jsx` | Both moderation writes ignored `{error}` → false-success toast + `null` propagated to parent. | Inspect `{error}` on both writes. |
| HIGH | `pages/admin/CommissionSettingsPage.jsx` | "Commission on Buy Now / Fixed" toggle was bound to the master `commissions_enabled` key → toggling it clobbered the global switch. | Bind to `commission_on_offers` (the key the backend reads for fixed-price). |
| HIGH | `pages/admin/CategoryManagementPage.jsx` | Root-category Edit/Delete/Add used `group-hover:` but no ancestor had `group` → controls permanently invisible. | Add `group` to the row. |
| MEDIUM | `pages/admin/UserDetailPage.jsx` | `displayName.substring()` crashed when name/username/email all null. | Fall back to `'User'`. |
| HIGH | `contexts/AccountContext.jsx` | Effect depended on the `currentUser` object identity (re-fetch storm); context value not memoised (consumer re-render storm). | Depend on `currentUser?.id`; `useMemo` the value. |
| CRITICAL | `hooks/usePhotoTemplate.js` | `setIsProcessing(false)` ran before the async FileReader→removeBackground job finished (premature "done"); object URLs never revoked. | Await the pipeline; revoke the prior blob URL. |

## ✅ Fixed — Payments (`commit: refund double-processing, NaN webhook`)

| Sev | Area | Bug | Fix |
|---|---|---|---|
| MEDIUM | `routes/stripe.js` `/refund` | No atomic claim between the status read and `stripe.refunds.create` → two concurrent admin clicks issue two refunds. | Atomic `approved → processing` claim + per-refund idempotency key; release on Stripe failure. |
| LOW | `routes/stripe.js` webhook | A NaN metadata amount made the reconciliation comparison always pass (`NaN > 2 === false`) → order inserted with NaN money fields. | Reject when any amount is non-finite. |

---

## ✅ Fixed — Money concurrency (`commit: atomic wallet, stock oversell, cart payouts`)

> ⚠️ **Two new migrations must be applied to the database for this commit to work:**
> `20260626000003_add_increment_wallet_balance_fn.sql` and
> `20260626000004_guard_decrement_shop_stock_fn.sql`. The code now calls these
> RPCs. Apply them via the Supabase dashboard/CLI before (or with) deploy.

1. **Seller wallet payout was a read-modify-write (lost updates / double-pay).**
   `payoutService.creditWallet` and `disputeService` clawback read
   `wallet_balance_aud` into JS and wrote it back; concurrent payouts overwrote
   each other. Now both use an atomic `increment_wallet_balance(uuid, numeric)`
   RPC (floors at 0, lockdown grants like `decrement_shop_stock`).
2. **Stock oversell on cart checkout.** `decrement_shop_stock` floored at 0
   (`greatest(0, …)`), so two buyers could both pay for the last unit and the
   oversell was invisible. The function is now guarded
   (`where stock_quantity >= qty`) and returns a boolean; the webhook flags an
   oversell (admin notification) for manual refund/restock instead of confirming
   it silently. Full reserve-at-checkout (with expiry) remains a possible future
   hardening, but the silent-oversell hole is closed.
3. **Cart-path sellers are now paid.** The cart confirmation branch credits each
   listing line's seller via `payoutSeller` (proceeds = `line_total_aud −
   commission_aud`), guarded by the existing atomic pending → payment_confirmed
   claim so it runs exactly once.

## ⏸️ Deferred — need a decision

### Product decisions

4. **GST base** (`routes/stripe.js`): `gst_on_commission_only` defaults `true`, so
   GST is charged on the ~3% commission, not the sale. Confirm the intended tax
   treatment (agency model vs GST-on-sale).
5. **Asking Price vs Estimated Value** (`pages/AddEditCardPage.jsx:2673`): the
   "Asking Price" input is bound to `formData.estimatedValue` — the same field as
   "Estimated Value", so they can't differ and `price_aud` is derived from the
   estimate at save. Making them independent needs a decision on how an
   independent asking price interacts with the locked-value floor.
6. **"Sessions"/"devices" security theatre** (`routes/auth/sessions.js`,
   `devices.js`): entries are self-asserted JSON; "revoke" edits the array but
   never invalidates the real Supabase token. Users will trust this — decide
   whether to implement real revocation or relabel it.
7. **Account suspend/ban/delete not wired** (`pages/admin/UserDetailPage.jsx` +
   `components/admin/UserActionsModal.jsx`): the modal calls `onConfirm`, but the
   page passes `onComplete` and there is no mutation — Suspend/Ban/Delete/Reset
   are no-ops, and `ACTION_LABELS` lacks `suspend`/`unsuspend`. Verify-business
   works; the rest needs implementing (delete requires a service-role backend call).

### Dead components with divergent schema (remove or rewrite when wired up)

- `components/TradeOfferModal.jsx` (not imported anywhere) writes `status:'pending'`
  and `initiator_listing_value`-style columns against `vault_items`, diverging
  from the canonical `useTradeRequests.proposeTrade` path (`'proposed'` status,
  `*_trade_value_aud` columns, `listings` table). No live UI currently *creates*
  trades via either path. Align or delete when trade creation is wired up.
- `components/UserDetailModal.jsx` (not imported) writes non-existent profile
  columns (`verified`, `emailVerified`, `accountLockedUntil`). The live admin path
  uses `is_verified`/`verification_status`/`is_active`.

### Other verified findings not yet fixed (lower risk, safe to batch later)

- `routes/market-data.js:21,113`, `price-history.js:103` — escape `%`/`_` in
  `ilike('%…%')` user terms (LIKE-wildcard scans).
- `components/EbayMarketSection.jsx`, `components/SearchBar.jsx`,
  `pages/community/LocalMapPage.jsx` — add cancellation/out-of-order guards to
  type-ahead/address fetches.
- Multiple admin pages swallow Supabase `{error}` (false-success on failed
  reads/writes/uploads) — see `CommissionSettingsPage`, `SubcategoryManagementPage`,
  `ProductLinesManagementPage`, `AdminDashboard`, `AnalyticsReportsPage`,
  `EventFormModal` image upload.
- `contexts/AccountContext`-style object-identity/value-memo issues localized;
  `use-integrated-ai.jsx` and `GradeEstimatorPage.jsx` leak `createObjectURL`.
- `pages/PublicCollectionsPage.jsx` `item.id.charCodeAt` crashes on numeric ids;
  `pages/VaultProfilePage.jsx` card modal binds non-existent camelCase fields.
- Reorder-by-`sort_order` swaps in several admin pages break on duplicate values
  (`CollectionSectionsAdminPage`, `HeroShowcaseAdminPage`, `CollectionsManagementPage`).

(The full per-domain finding lists from the eight sweeps are preserved in the PR
discussion / session transcript.)

---

## 🔎 Investigated — not a bug

- **HomePage hero stack** (`pages/HomePage.jsx:288`): the floating stack uses
  static layout/animation props (`rotate`/`x`/`y`/`floatY`/`delay`) and a `stem`
  image format the fetched rows don't have, and the dynamic
  `<HeroCardShowcase cards={heroCards}>` right below it *already* renders the
  admin-configured cards. Switching the decorative stack to `heroCards` would
  break the layout — left as-is.

## ⚠️ Pre-existing — out of scope

- `tests/backend/ebay.test.js` — 2 failures (`returns price statistics on success`,
  `returns 502 when the eBay API throws`) fail on a clean checkout of this branch,
  before any change here. The `callEbayApi` mock isn't intercepting the cached
  client (the route returns 4 results / status 200 instead of the mocked 2 / 502).
  A test-harness/mocking issue, unrelated to this audit.

---

## Verification

- `npm test` (full suite): **1502 passed**, 3 skipped, only the 2 pre-existing
  eBay failures remain. Tests that encoded the *old buggy* behaviour were updated
  to assert the corrected behaviour (ipKeyGenerator, mfa, backup-codes,
  rate-limit, supabase-auth, event-scraper, useWatchlist).
- `npx eslint` clean on all changed files.
