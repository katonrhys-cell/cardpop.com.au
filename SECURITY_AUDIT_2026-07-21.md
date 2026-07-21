# CardPop — Full Site Security Audit

**Date:** 2026-07-21
**Scope:** Full-stack review — Express API (`src/`), React SPA, Supabase RLS/policies (all 112 migrations + live Security Advisors), Stripe/PayPal money flows, auth/MFA, secrets/config/headers/CORS/CSP, rate limiting/DoS, file uploads, injection/XSS/SSRF, and committed repository contents.
**Method:** Five parallel specialist code-audit passes, cross-checked against the live production database's Supabase Security Advisors and by-hand verification of every Critical/High finding (including extracting the exposed credential material and tracing the exploit code paths end-to-end).

---

## Executive summary

The application is **strongly engineered for security**. The two Criticals from the previous audit (`SECURITY_AUDIT_2026-07-15.md`) are **genuinely fixed** and independently re-verified:

- `profiles` column-level read exposure — fixed by `20260715210000` (blanket SELECT revoked; sensitive financial/identity columns excluded from the anon grant).
- `profiles` UPDATE privilege escalation — fixed by `20260720150000`, which pins every privileged column (`is_admin`, `wallet_balance_aud`, all Stripe/PayPal/subscription/identity ids, reputation columns, `is_featured_seller`, `has_saved_card`).

The injection / XSS / SSRF / upload surface is **exemplary**: DNS-rebinding-safe SSRF defense on the event scraper, magic-byte upload validation that rejects SVG/HTML, app-wide Trusted Types + DOMPurify, and correctly bounded JSON-RPC batch handling. Server-authoritative pricing, correct Stripe webhook signature + idempotency, and thorough RLS tamper-triggers are all in place. `npm audit` shows only 1 moderate transitive issue.

However, this audit found **1 Critical, 1 High, and 8 Medium** issues that warrant action. The two most urgent — a committed credential/PII database and an arbitrary-price purchase bug — are **remediated in this same change** (see "Remediation applied"). The rest are documented with fixes below.

| # | Severity | Title | Area | Status |
|---|----------|-------|------|--------|
| C1 | **Critical** | Legacy `pb_data/` PocketBase DB committed — leaks password hashes, auth tokenKeys, emails, addresses | Secrets/PII | **Fixed in tree; history purge + rotation required** |
| H1 | **High** | Buyer can purchase any listing at a self-chosen price via an unaccepted `pending` offer | Payments | **Fixed** |
| M1 | Medium | MFA (AAL2) enforced only on `/admin` router — other privileged endpoints bypassable | AuthZ | **Fixed** |
| M2 | Medium | Brute-force login lockout is client-enforced and trivially bypassable | Auth | **Documented; enable Supabase CAPTCHA + rate limits (config)** |
| M3 | Medium | Password change does not revoke other active sessions | Auth | **Fixed** |
| M4 | Medium | Rate limiters use in-memory store — ineffective across serverless instances | DoS | **Fixed (sensitive limiters)** |
| M5 | Medium | 20 MB body limit applied by path prefix *before* auth on event-scraper | DoS | **Fixed** |
| M6 | Medium | Wallet double-spend TOCTOU — sub-second concurrent race still open | Payments | **Fixed** |
| M7 | Medium | Refund-request TOCTOU → potential double Stripe refund | Payments | **Fixed** |
| M8 | Medium | `vault_items.is_featured` self-settable — bypasses admin homepage curation | RLS | **Fixed** |
| L1–L10 | Low/Info | See "Low-severity findings" | Various | Open |

> **Update (all Mediums addressed):** M1, M3–M8 are fixed in code/migrations on this branch; M2's fix is Supabase dashboard configuration (the Turnstile CAPTCHA code is already wired) — see `docs/auth-brute-force-protection.md`. C1 still needs the owner to purge git history and rotate the exposed credentials. Per-item detail below.

---

## Critical

### C1. Legacy `pb_data/` PocketBase database committed to the repo (credential + PII exposure)

**Where:** `pb_data/data.db` (1.2 MB), `pb_data/auxiliary.db`, WAL/SHM, and `pb_data/storage/**` — **42 files tracked in git, not in `.gitignore`.**

**Problem:** A full legacy PocketBase SQLite database (from before the app migrated to Supabase) is committed. It contains **real** account data. Verified by hand — the DB holds live bcrypt hashes and PocketBase auth `tokenKey`s for actual accounts:

- `_superusers`: `katonrhys@gmail.com` (project owner / admin) — bcrypt `$2a$10$cLSqGtY8…` + `tokenKey`.
- `users` (3 rows): `katonrhys@gmail.com`, `rfkates09@hotmail.com` (Ryan Conway), `haymesnathan@gmail.com` — bcrypt hashes (`$2a$08$…` / `$2a$10$…`), `tokenKey`s, plus `backupCodes`, `passwordHistory`, `lastLoginIp`, `trustedDevices`, `mfaEnabled`, and address/location fields.

**Impact:** Anyone with repo (or clone/history) access can offline-crack the bcrypt password hashes and possesses the token-signing material for the admin superuser, plus third-party PII (emails, addresses). This is a credential + personal-data breach regardless of whether a PocketBase instance is still live. Because passwords are frequently reused, the owner's hash is the highest-value target.

**Remediation applied in this change:**
- `git rm -r --cached pb_data` — the 42 files are removed from tracking (kept on local disk, nothing destroyed).
- `pb_data/` added to `.gitignore` so it cannot be re-committed.

**Remediation still REQUIRED (needs owner action — destructive / out-of-band, not done automatically):**
1. **Purge from git history** and force-push: `git filter-repo --path pb_data --invert-paths` (or BFG), then coordinate a force-push. Until this is done the data remains in every clone and on the remote.
2. **Treat all four accounts as compromised** — rotate the passwords for `katonrhys@gmail.com`, `rfkates09@hotmail.com`, `haymesnathan@gmail.com`, and the PocketBase superuser; consider notifying the two non-owner users (PII exposure).
3. Confirm no PocketBase instance is still running with these credentials/tokenKeys.

---

## High

### H1. Arbitrary-price purchase via an unaccepted `pending` offer

**Where:** `src/services/checkoutService.js:41-63` (the `offerId` branch of `createSingleItemCheckout`).

**Problem:** The offer branch charged `offer.amount_aud` whenever the offer status was **`pending`** — a `pending` offer is the *buyer's own, un-accepted* proposal, whose `amount_aud` the buyer fully controls. There is **no server-side floor** on the offered amount: offers are inserted client-side under RLS, the base INSERT policy only ties `buyer_id` to `auth.uid()`, there is no CHECK constraint bounding `amount_aud`, and the tamper trigger (`20260706202907`) only freezes `amount_aud` *after* insert. Worse, the status gate was inverted — it **rejected** seller-`accepted` offers and **accepted** un-consented `pending` ones. The client-side `> 0` / `≤ 1.5×` checks in `MakeOfferModal.jsx` are trivially bypassed by calling Supabase/the API directly.

**Exploit (two authenticated calls, verified-email account):**
```js
// 1. Insert a $1 offer on a $1000 active listing (buyer_id defaults to self)
supabase.from('offers').insert({ listing_id, buyer_id: me, seller_id, amount_aud: 1 })
// 2. Check out on it — server charges $1, webhook marks the listing sold,
//    seller is paid ~$1, and only THEN is the offer flipped to 'accepted'.
POST /hcgi/api/stripe/create-checkout { listingId, offerId }
```
The seller never consented to the price. Direct financial loss to sellers / the platform.

**Fix applied:** The status gate now requires seller consent — it allows **`accepted`** (charge `amount_aud`) and **`countered`** (charge `counter_amount_aud`) and **rejects `pending`**. The frontend offer-checkout path is currently dormant (no caller passes `offerId` to `CheckoutModal`), so this change closes the hole with no user-facing regression. If a "pay my offer immediately" feature is ever wired up, it must go through seller acceptance first, and `itemPrice` should additionally be floored server-side.

---

## Medium

### M1. AAL2/MFA step-up enforced only on the `/admin` router

**Where:** `src/middleware/requireAal2.js` is applied only at `src/routes/admin.js:33`. It is **absent** from other privileged endpoints, including `POST /partners/admin/payout` (`partners.js:62`, moves money to a Stripe Connect account), `buyer-protection.js:99` (`PUT /:claimId/status`, sets refund amount), `reports.js:160`, `seller-ratings.js:152`, `vault.js:143`, `categories.js`/`subcategories.js`, `market-data.js:74`, `price-history.js:65`, `stores.js:124`, `event-scraper.js:273,302,416`.

**Impact:** `requireAal2`'s own docstring describes the threat: an attacker with a stolen admin password can mint an AAL1 token directly against Supabase's public auth endpoint, skipping MFA. `requireAal2` closes this for `/admin/*`, but `isAdminUser()` still returns true for that AAL1 token everywhere else — so a password-only attacker is blocked from `/admin/users/:id/role` yet can still trigger a partner payout, resolve buyer-protection claims with a refund amount, rewrite seller stats, or adjust vault base values.

**Fix:** Introduce a shared `requireAdmin` composite (`authMiddleware → isAdminUser → requireAal2`) and apply it to every admin-privileged handler. Prioritize `partners/admin/payout`.

### M2. Brute-force login lockout is client-enforced and bypassable

**Where:** `src/routes/auth/login.js` + `contexts/AuthContext.jsx:229-246`.

**Impact:** The `(email, ip)` lockout is only consulted by the client *before* it calls `supabase.auth.signInWithPassword` directly against Supabase (public anon key). An attacker doing credential stuffing calls GoTrue directly and never touches `/auth/login/attempt` or `/record-failure`, so the counter is never incremented. Only Supabase's own native rate limits actually apply; the custom lockout is telemetry, not a boundary.

**Fix:** Enforce lockout where the credential check happens — proxy password sign-in through a backend endpoint that checks the lockout before calling GoTrue, and/or enable Supabase native rate-limiting + CAPTCHA. At minimum, document that the table is not a security boundary.

### M3. Password change does not revoke other active sessions

**Where:** `src/routes/auth/password.js:122-128`.

**Impact:** After changing the password, the handler clears a custom `user_security.active_sessions` column but never revokes Supabase/GoTrue refresh tokens. An attacker holding a stolen session keeps refreshing after the victim changes their password — defeating the main reason to change it.

**Fix:** Call `supabase.auth.admin.signOut(userId, 'others')` (or delete the user's refresh tokens) in the change flow.

### M4. Rate limiters use in-memory store — ineffective across serverless instances

**Where:** `src/middleware/global-rate-limit.js`, `endpoint-rate-limit.js`, `integrated-ai-rate-limit.js` (default `MemoryStore`).

**Impact:** On Vercel the API fans out to multiple warm instances; per-instance counters mean the effective limit is `max × instanceCount`, and cold starts reset counts. Login lockout, the AI limiter, pwned-check, and email-triggering limiters are all weakened. Cloudflare's edge rate-limit is the real protection, so this is defense-in-depth — but the Express limits advertised as controls are largely illusory in prod.

**Fix:** Back the limiters with a shared store (Upstash/Redis via `rate-limit-redis`, or a Postgres-backed store). Ensure the Cloudflare edge rule covers login/AI/email endpoints.

### M5. 20 MB body limit applied by path prefix before authentication

**Where:** `src/app.js:81` (`req.path.includes('/event-scraper') ? LargeBodyLimit : BodyLimit`), `src/constants/common.js:14`.

**Impact:** The JSON parser selects the 20 MB limit for any path containing `/event-scraper` and parses the body *before* `authMiddleware`/`isAdminUser`. An unauthenticated attacker can POST ~20 MB to `/hcgi/api/event-scraper/*` and force full parse/allocation before the 403. `includes()` also matches broader than intended.

**Fix:** Gate the large limit behind admin auth (parse small by default; accept the large body only on the specific authed sub-route via a route-scoped `express.json({limit})`). Use an exact prefix, not `includes`.

### M6. Wallet double-spend TOCTOU — sub-second concurrent race remains

**Where:** `src/services/walletService.js:94-126` (`assertNoOpenWalletCheckout`), `:158-184`; call sites `checkoutService.js:166`, `stripe.js:285`.

**Impact:** The wallet coupon is sized from a live balance read at session creation but debited at webhook completion. `assertNoOpenWalletCheckout` (list `open` sessions) closes the sequential/multi-tab case only; the code documents that a sub-second concurrent race can still slip through, after which `debitWalletForOrder` posts the full debit anyway (balance goes positive = customer owes) and merely alerts admins. A buyer with credit can extract up to ~2× the discount in a timing window.

**Fix:** Make the reservation atomic in the DB, mirroring the welcome-offer fix — a single-flight wallet-reservation row / `SELECT … FOR UPDATE` on the profile, or debit at session creation and credit-back on `checkout.session.expired`.

### M7. Refund-request TOCTOU → potential double Stripe refund

**Where:** `src/routes/refunds.js:54-77` (check-then-insert); `src/services/refundService.js:53-91`.

**Impact:** `/refunds/request` checks `order.refund_status` then inserts, with no verified unique constraint on `refunds(order_id)` (the `refunds` table isn't created by any repo migration, so uniqueness is likely absent). Two concurrent requests create two refund rows. `processRefund`'s guards are per-refund-row, so if both are approved and processed near-simultaneously each creates a Stripe refund under a different idempotency key (`refund_${refundId}`) → buyer refunded twice.

**Fix:** Add a partial unique index on `refunds(order_id)` for non-terminal statuses, and key Stripe idempotency on `order_id` (or re-assert `order.status <> 'refunded'` inside an atomic guard).

### M8. `vault_items.is_featured` is self-settable — bypasses admin homepage curation

**Where:** `public.vault_items`, policy `vault_items_update_access` (final state in `20260719113047_consolidate_multiple_permissive_policies.sql:198-207`).

**Impact:** `is_featured` controls the homepage "Recent Vault Additions"/featured grid and is documented as admin-only, but the owner branch of the UPDATE policy pins no columns. An authenticated owner can `update({ is_featured: true }).eq('owner_id', me)` and jump their own cards onto the homepage — the same class of bug that `is_featured_seller` was hardened against. (`estimated_value_aud` on the same policy is likewise owner-writable — see L8.) No PII/funds at risk; marketplace-fairness/integrity issue.

**Fix (mirror the reputation-column lock):** recreate `vault_items_update_access` pinning `is_featured` (and optionally `estimated_value_aud`) in the owner branch — `NOT (is_featured IS DISTINCT FROM (SELECT v.is_featured FROM vault_items v WHERE v.id = vault_items.id))` — or add a `BEFORE UPDATE` trigger blocking non-admin changes. New migration via `supabase migration new`.

---

## Low-severity findings

- **L1. Supabase Auth leaked-password protection disabled** (live Security Advisor). Enable HaveIBeenPwned checking: Dashboard → Auth → Password security. Free, high-value.
- **L2. CSP `trusted-types` uses `*` wildcard** (`vercel.json:461,502`) — any script can mint a policy of any name, diluting Trusted Types. Prefer an explicit allowlist of the app's policy names.
- **L3. `script-src`/`style-src` include `'unsafe-inline'`** (`vercel.json`). For `script-src` this is neutralized by `'strict-dynamic'` on modern browsers (legacy fallback only). `style-src 'unsafe-inline'` is a genuine minor weakening (inline style injection). Drop where legacy support isn't needed.
- **L4. `profiles` exposes `is_admin`, `verification_status`, `abn` to anon** (`20260715210000` grant list). Leaks who the admins are and each user's verification/ABN. Consider removing `is_admin` from the anon grant (the frontend can derive admin UI from the session, not from reading arbitrary rows).
- **L5. Inconsistent `escapeLike` on frontend `ilike` queries** — `ListingsManagementPage.jsx:64`, `CategoryPage.jsx:40`, `ShopCategoryPage.jsx:58`, `CollectionPage.jsx:504`, `CardAnalyticsPage.jsx:252-253`, `CollectionSectionsAdminPage.jsx:78`. LIKE-wildcard broadening / mild scan-DoS only (PostgREST parameterizes the value; RLS still applies). Wrap terms in `escapeLike()` for consistency with the backend.
- **L6. Event-scraper mass-assignment** (`event-scraper.js:429-431`) — `create-event-from-data` spreads `...eventData` into `insert()`. Admin-only + service-role, so low risk, but an admin could set unintended columns. Whitelist via the existing `validateAndNormalizeEventData` instead of raw spread.
- **L7. Backup-code entropy is 32-bit** (`src/utils/otpGenerator.js:12`, `randomBytes(4)`). CSPRNG usage is correct and online brute force is limiter-mitigated; consider ≥64-bit codes as margin.
- **L8. `vault_items.estimated_value_aud` owner-writable** (same policy as M8). Cosmetic value inflation on the owner's own cards; pin it if it drives any buyer-facing "market value" display.
- **L9. Hardcoded Sentry DSN** (`src/app.js:17`). A DSN is ingest-only and public by design — informational; source from env for hygiene.
- **L10. Partner referral discount has no per-buyer reuse cap** (`partnerService.js`, `stripe.js:263-277`). Referred buyers get the discount on every order and the partner earns commission each time — by design for referrals, but note the compounding platform-funded cost.

**Informational — Supabase Advisor `SECURITY DEFINER` warnings** (`accept_trade`, `admin_set_featured_seller`, `can_sell`, event RSVP functions): reviewed and **by design** — each authorizes internally against `auth.uid()` / `is_admin` and pins `search_path`. No action needed. Two tables (`data_deletion_requests`, `launch_registrations`) have RLS enabled with no policy — correct (service-role-only, deny-all to anon/authenticated).

---

## Verified-clean areas (no action)

- **SSRF** (event-scraper, AI image fetch): literal-IP + DNS-rebinding-safe pinned lookup; https host allowlist for AI images.
- **File uploads**: magic-byte validation rejects SVG/HTML; storage keys use `randomBytes` + detected extension (no path traversal); Sharp re-encode neutralizes polyglots.
- **XSS**: `dangerouslySetInnerHTML` double-sanitized (DOMPurify + Trusted Types default policy); `api/prerender.js`/`sitemap.js` escape all reflected/DB values.
- **Injection**: `.or()`/`ilike` backend filters use `escapeLike`/sanitizers; MCP tool inputs sanitized; prior `search-suggestions` `.or()` injection fixed.
- **Payments (except H1)**: server-authoritative pricing, hardcoded AUD, server-derived `transactionType`, Stripe webhook signature + event idempotency, amount cross-check auto-refund, atomic `claimListingSold`/stock/wallet CAS, welcome-discount reuse fixed (`20260715250000`), refund fee from server order row, payout-reversal guards, IDOR checks on order/refund/wallet/session endpoints.
- **RLS**: every table has RLS enabled; policies key on `auth.uid()`; tamper triggers on offers/messages; private tables locked to service role; prior `profiles`/`local_game_stores`/`event_rsvps` exposures fixed.
- **Config**: CORS is an explicit allowlist (no reflection); `trust proxy` correctly trusts only Cloudflare ranges (`req.ip` unspoofable); error handler fails closed (no stack leak in prod); no hardcoded live secrets; service-role key never reaches client code.
- **Dependencies**: `npm audit` — 1 moderate transitive (`protobufjs` DoS via `.proto` parsing; not on a request path). `npm audit fix` when convenient.

---

## Remediation applied on this branch

1. **C1** — `pb_data/` removed from git tracking and added to `.gitignore`. *(History purge + credential rotation still required — see C1.)*
2. **H1** — `checkoutService.js` offer-status gate corrected to require seller consent (`accepted`/`countered`), rejecting un-accepted `pending` offers.
3. **M1** — new `requireAdmin` composite (auth → admin → `requireAal2`) applied to every privileged endpoint outside `/admin` (partner payout, buyer-protection, reports, seller-ratings, vault base-value, categories/subcategories, market-data, price-history, stores, event-scraper).
4. **M3** — password change now calls `supabase.auth.admin.signOut(token, 'others')` to revoke all other sessions.
5. **M4** — security-sensitive limiters (backup-code, login/password advisory, email-triggering, pwned-check, AI) backed by a shared Postgres store (`PgRateLimitStore` + `rate_limit_hit` RPC), fail-open; high-volume limiters stay in-memory behind Cloudflare.
6. **M5** — global body parser skips the event-scraper router; a router-level auth+admin gate now parses the large body only after authorization.
7. **M6** — atomic per-user wallet-checkout reservation (`reserve_wallet_checkout` CAS) closes the sub-second race; released at completion/expiry/failure with a TTL safety net.
8. **M7** — Stripe refund idempotency keyed on `order_id`; partial unique index `refunds_one_active_per_order` prevents a second active refund row.
9. **M8** — `vault_items_update_access` recreated pinning `is_featured` against owner self-writes.
10. **M2** — `docs/auth-brute-force-protection.md` + code comment; the real fix (Supabase-native CAPTCHA/rate limits) is dashboard configuration — the Turnstile client code is already wired.

**Still requires owner action (out of band):** C1 git-history purge + credential rotation; M2 Supabase dashboard config (Turnstile CAPTCHA + Auth rate limits); L1 leaked-password protection toggle. The Low/Info items (L2–L10) remain open for review.
