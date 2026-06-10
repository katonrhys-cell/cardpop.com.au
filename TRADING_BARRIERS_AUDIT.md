# CardPop Trading Barriers Audit

**Date:** 2026-06-10
**Scope:** Full-stack audit of what currently blocks CardPop from operating as a world-class card trading marketplace. Covers the live Supabase database (advisors + schema), the Express backend, the React frontend, and the end-to-end trade/purchase lifecycle.

---

## Executive Summary

CardPop is architecturally sound (React SPA + Express on Vercel + Supabase) and payment *collection* works, but it is not yet a functioning two-sided marketplace. The four most fundamental barriers are:

1. **Sellers can never get paid.** Commission and `seller_proceeds_aud` are calculated and stored, but there is no Stripe Connect integration, no payout records, and no payout execution. Money flows Buyer → Stripe → CardPop and stops there.
2. **Orders have no lifecycle after payment.** Status reaches `payment_confirmed` and never transitions to `shipped` / `delivered` / `completed`. There is no shipping label or tracking integration and no dispute window, which means unlimited chargeback liability.
3. **Trading has no server-side business logic.** There are no `/trades`, `/offers`, or `/auctions` Express routes — all trade state changes are direct client-side Supabase writes relying on RLS that is not documented or confirmed for the `trades` table. No locking, no race-condition handling, no escrow.
4. **Auctions — the stated Phase 2 growth lever — do not exist.** Only the data model stubs (`listing_type: 'auction'`, `auction_end_at`) are present. No `bids` table, no bid endpoint, no anti-snipe, no settlement.

Below the fold, serious authorization holes (anyone can post seller ratings or close buyer-protection claims), serverless-incompatible infrastructure (in-memory rate limiters and CSRF tokens), and frontend scale ceilings (hard 100-item limit, ILIKE-only search, no caching layer) compound these problems.

---

## 1. CRITICAL — Money Flow & Payouts

| Finding | Evidence |
|---|---|
| No seller payout mechanism | `src/routes/stripe.js` computes `sellerProceedsAud` and writes it to `orders`, but no Stripe Connect account linking (`profiles.stripe_account_id` absent), no `payouts` table, no transfer logic |
| No payout dashboard | Sellers cannot see earnings or cash out anywhere in the UI |
| Refunds reverse proceeds that were never paid | `stripe.js:515-628` deducts proceeds on refund, but payout never occurred |
| No refund idempotency | `stripe.refunds.create()` called without an `idempotency_key` — retried requests can double-refund |
| No webhook replay protection | Dedup via `stripe_session_id` happens only after heavy processing; no early idempotency gate |

**Effect:** CardPop is currently a single-merchant shop bolted onto a multi-seller UI. This blocks marketplace viability entirely.

---

## 2. CRITICAL — Order Fulfillment Lifecycle

- `orders.status` supports `payment_confirmed | shipped | delivered | cancelled | refunded` (per PRD §3.5) but **no code ever sets anything past `payment_confirmed`**.
- No seller "mark as shipped + tracking number" workflow.
- No buyer delivery confirmation, no carrier integration (Australia Post / Sendle), no label generation.
- No dispute window — buyers can file claims indefinitely; sellers have no protection either.
- Shipping PII (name, full address) stored in cleartext in `orders` with no redaction policy.

**Effect:** Funds are held in limbo forever; disputes are unresolvable; chargeback liability is unbounded.

---

## 3. CRITICAL — Trading & Auction Logic

### P2P trades
- `hooks/useTradeRequests.js` performs all trade state changes (`accept`, `decline`, cash top-up assignment) as **direct client-side Supabase writes**.
- `src/routes/index.js` registers 20+ routers but **zero routes for trades, offers, or auctions**. `verifyTradeAccess` middleware matches paths containing "trade" — paths that never exist.
- No documented RLS policies on the `trades` table (DATABASE_SCHEMA.md covers `seller_ratings`, `buyer_protection_claims`, `wishlists` — not `trades`).
- No escrow: trade `accepted` = done. A counterparty can accept and never ship with zero recourse.
- No locking: two offers on the same listing can be accepted concurrently with no rollback.

### Auctions
- PRD §7 specifies the full system; none of it is built: no `auctions`/`bids`/`auction_notifications` tables, no bid endpoint, no anti-snipe extension, no reserve logic, no settlement.
- Notification types (`bid_placed`, `bid_outbid`, `auction_ending_soon`, …) and `useCountdown()` exist as dead infrastructure.
- PRD §8.3 anti-fraud controls (bid velocity caps, 7-day account age, shill detection, first-auction review) have no implementation.

---

## 4. CRITICAL — Authorization Holes (Backend)

| Endpoint | Hole |
|---|---|
| `POST /seller-ratings` (`src/routes/seller-ratings.js:57-105`) | Accepts `seller_id` and `reviewer_id` straight from the client with **no auth check** — anyone can fabricate 5-star reviews or trash a competitor |
| `PUT /buyer-protection/:claimId/status` (`src/routes/buyer-protection.js:101-145`) | Comment says "skip admin check for development" — **any user can close/deny anyone's dispute** |
| `PUT /seller-ratings/:sellerId/performance` | Any user can overwrite any seller's `response_time`, `successful_sales`, `total_sales` (IDOR) |
| CSRF middleware (`src/middleware/csrf.js`) | Exists but **never mounted** in `src/app.js`; token store is an in-memory `Map()` that cannot work across serverless instances anyway |

---

## 5. CRITICAL/HIGH — Serverless-Incompatible Infrastructure

- **Rate limiting is per-instance memory** (`endpoint-rate-limit.js`, `global-rate-limit.js`): N Vercel instances ⇒ N× the intended limit. Needs a shared store (e.g. Upstash Redis).
- **eBay cache is an in-memory `Map`** (`src/utils/ebayCache.js`) — wiped on every cold start, so the 1-hour TTL rarely survives; cost and latency suffer.
- **Auth middleware calls `supabase.auth.getUser(token)` on every request** with no local JWT verification or caching — 100–500 ms added per request.
- **Session IDs are weak** (`session_${Date.now()}_${Math.random()...}` in `auth/sessions.js`), stored as a JSON array on `profiles`, never validated against IP/device on later requests.
- **MFA is optional even for sellers** — once payouts exist, a compromised seller account means stolen funds.
- Hard-coded Sentry DSN in `app.js`; anon key fallback hard-coded in `auth/password.js`; no key rotation strategy.

---

## 6. Database Findings (Supabase Advisors, live project)

| Level | Finding |
|---|---|
| ERROR | `public.events_public` view uses `SECURITY DEFINER` — queries run with the creator's privileges, bypassing the querying user's RLS |
| INFO | `public.user_security` has RLS enabled but **zero policies** — all access blocked (or a sign the table is unmanaged) |
| WARN | `pg_net` extension installed in the `public` schema |
| WARN | Leaked-password protection (HaveIBeenPwned check) disabled in Supabase Auth |

Additional schema-integrity gaps: `refunds`, `fee_config`, and `platform_settings` are queried by `stripe.js` but undocumented in DATABASE_SCHEMA.md; `bids`, `auctions`, `auction_notifications` required by the PRD don't exist.

---

## 7. CRITICAL/HIGH — Frontend Scale Ceilings

| Barrier | Evidence | Effect |
|---|---|---|
| Hard pagination cap | `MarketplacePage.jsx` `.limit(100)`, `BrowseListingsPage.jsx` `.limit(24)`, no offset/cursor UI | Catalog invisible past first fetch; breaks at scale |
| ILIKE-only search | `ilike('%q%')` on `card_name`/`description`; no `tsvector` full-text index | Typos and case/spelling variants return nothing |
| No caching layer | No react-query/SWR; every page is raw `useEffect` + fetch; `PublicSellerProfilePage` fires 3 uncached queries per visit | N+1 load, slow mobile, DB cost scales with page views |
| No realtime for commerce | Realtime only on messages + dashboard; auctions/offers/trades require manual refresh | Stale marketplace; auctions unviable without live bids |
| Unoptimized images | `getPublicUrl()` per render; Supabase storage origin only (no CDN); hero JPEGs up to 971 KB; no WebP/AVIF | 2–3× slower pages than competitors; Core Web Vitals penalty |
| No list virtualization | 100 ProductCards rendered at once | Jank/crashes on older phones |
| AUD-only, no i18n | `price_aud` columns, single `formatCurrency('en-AU','AUD')` | Locked out of NZ/SG/UK/US markets |
| SPA with no pre-rendering | Client-only rendering, `react-helmet`, static og:image | Listings largely invisible to Google; no social previews |
| No PWA | No manifest, no service worker | No offline vault, no home-screen install |
| Context re-render storms | One mega AuthContext, unmemoized context values | Cart/profile updates re-render the whole app |
| Dead PocketBase code | `pocketbase` dependency, `lib/pocketbaseClient.js`, import in `CheckoutPage.jsx` | ~150 KB bundle waste, developer confusion |

---

## 8. HIGH — Data Model: No Canonical Card Catalog

Listings are free-text strings ("Pokémon Base Set Charizard Holo, PSA 9"). There is no `cards` table with set ID / card number / variant, so:

- No price aggregation per card+grade ("market price for this exact card").
- Search cannot group the same card across sellers.
- No structured trend analytics; eBay pricing integration sits on top of unstructured data.
- Bulk listing import is impossible.

TCGPlayer/Cardmarket are built around canonical SKUs; this gap will require a rebuild if deferred.

---

## 9. MEDIUM — Trust, Reputation & Notifications

- Seller ratings infrastructure half-built: table documented, tier badges defined, but no tier-calculation logic and no rating display on profiles.
- No KYC / identity-to-bank linking for sellers (regulatory + fraud exposure once payouts exist).
- No fraud detection of any kind (velocity, device, chargeback history).
- `notifications` table is written to, but there is **no notification-centre UI** — users only learn of events via email.
- Vault privacy enforced only by client-side `canViewVaultProduct()` + app-layer checks, not confirmed RLS.

---

## 10. Recommended Sequence

**Phase 0 — Make it a real marketplace (blocking):**
1. Stripe Connect onboarding (`profiles.stripe_account_id`), KYC, payout execution post-delivery.
2. Order state machine: `payment_confirmed → shipped (tracking) → delivered → completed (payout released)`, with a 7-day dispute window.
3. Lock down authorization: auth on seller-ratings and buyer-protection endpoints; mount CSRF; verify/add RLS on `trades`.

**Phase 1 — Server-side trading + auctions:**
4. Express routes for trades/offers (`POST /trades/:id/accept` etc.) with transactions and locking; deprecate direct client writes.
5. Build auctions per PRD §7: `auctions`/`bids` tables, validated bid endpoint, anti-snipe, settlement.
6. Move rate limiting + CSRF tokens + eBay cache to Redis (Upstash).

**Phase 2 — Frontend scale:**
7. Cursor pagination + `tsvector` full-text search + react-query caching.
8. Image CDN (Vercel Image Optimization or Cloudflare Images) and list virtualization.
9. Realtime subscriptions for bids/offers/trades; notification centre UI.

**Phase 3 — Growth:**
10. Canonical card catalog (`cards` table, SKU-mapped listings, aggregate pricing).
11. Multi-currency + i18n; pre-rendering/SSR for SEO; PWA.
12. Fix Supabase advisor items (SECURITY DEFINER view, `user_security` policies, `pg_net` schema, leaked-password protection) and remove PocketBase remnants.
