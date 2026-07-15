# CardPop — Full Security Site Audit

**Date:** 2026-07-15
**Scope:** Full-stack review — Express API (`src/`), React SPA, Supabase RLS/policies (live DB + migrations), Stripe/PayPal money flows, secrets/config/headers, file uploads/storage, dependencies, MCP surface.
**Method:** Six parallel code-audit passes plus live verification against the production database's Supabase Security Advisors and `pg_policies`. Top findings re-verified by hand.

---

## Executive summary

The codebase is **notably security-conscious**: server-authoritative pricing, correct Stripe webhook signature verification, timing-safe HMAC on the Facebook data-deletion callback, thorough profile-write locking, anti-tamper triggers on offers/messages, magic-byte upload validation, and a genuinely excellent SSRF defense on the event scraper (DNS-rebinding-safe). `npm audit` is clean (0 vulns). No hardcoded secrets; the service-role key never reaches the client.

However, the audit found **1 Critical, 2 High, and 6 Medium** issues that warrant action. The single most urgent is a data-exposure bug: the `profiles` table is world-readable at the column level, leaking every user's wallet balance and Stripe/PayPal identifiers to anyone holding the (public) anon key.

| # | Severity | Title | Area |
|---|----------|-------|------|
| 1 | **Critical** | `profiles` leaks financial/identity columns to anon (world-readable) | RLS |
| 2 | **High** | MFA (AAL2) never enforced server-side → admin MFA bypass | AuthZ |
| 3 | **High** | Wallet-balance double-spend via concurrent checkouts (TOCTOU) | Payments |
| 4 | Medium | `local_game_stores` public read exposes `submitter_email` | RLS |
| 5 | Medium | One-time welcome discount reusable across concurrent checkouts | Payments |
| 6 | Medium | MCP JSON-RPC batch handler → request amplification DoS | DoS |
| 7 | Medium | Global 20 MB JSON body limit → amplification DoS | DoS |
| 8 | Medium | Public-bucket SVG/HTML upload → cross-subdomain stored XSS | Upload/XSS |
| 9 | Medium | `user_verifications` INSERT doesn't constrain `status`/admin fields | RLS |
| 10–20 | Low | See "Low-severity findings" below | Various |

---

## Critical

### 1. `profiles` is world-readable and leaks financial / identity columns

**Where:** `profiles` SELECT policy `"Public profiles are viewable by everyone"` — `FOR SELECT TO public USING (true)` (predates the repo; confirmed live in `pg_policies`). No column-level grants exist — verified: there is no `revoke/grant select(...)` on `profiles` in any migration.

**Problem:** RLS is row-level, not column-level. `USING (true)` exposes **every column of every row** to the `anon` role. `20260706202906_lock_profile_financial_columns.sql` locks these columns against **writes** but nothing restricts **reads**. Exposed columns include:
`wallet_balance_aud`, `stripe_customer_id`, `stripe_subscription_id`, `paypal_subscription_id`, `stripe_identity_session_id`, `subscription_status`, `subscription_provider`, `trial_ends_at`, `verification_status`, `is_verified`, `is_admin`.

**Exploit (anon key ships in the frontend bundle):**
```js
supabase.from('profiles')
  .select('id, wallet_balance_aud, stripe_customer_id, stripe_subscription_id, paypal_subscription_id, is_admin')
// returns these fields for EVERY user
```
Impact: bulk harvest of Stripe/PayPal customer & subscription identifiers and per-user wallet balances, plus enumeration of every admin account (`is_admin = true`) to focus further attack. The app already reads `profiles` unauthenticated (`pages/CommunityPage.jsx`, `SellerProfilePage.jsx`, `UserProfilePage.jsx` do `select('*')`), so simply tightening the policy requires narrowing those client reads too. (Raw contact PII — email/DOB/address — is **not** on `profiles`; it lives in `auth.users`/RLS-protected `user_verifications`, so this is financial-identifier + account-metadata exposure, not contact-PII.)

**Fix:** Keep the row policy but strip column read access from the API roles (PostgREST honors Postgres column privileges):
```sql
revoke select on public.profiles from anon, authenticated;
grant select (id, username, display_name, avatar_url, bio, business_name, business_logo_url,
              business_tagline, store_slug, location_state, location_suburb, rating,
              reviews_count, total_sales, seller_tier, is_featured_seller, is_verified,
              is_public, is_sole_trader, created_at /* + other truly-public columns */)
  on public.profiles to anon, authenticated;
```
Enumerate the safe column list explicitly; leave out financial/identity columns. Own-full-row reads should go through the backend service-role client or a policy scoped to `auth.uid() = id`. Ship as a migration (`supabase migration new lock_profile_read_columns`).

---

## High

### 2. MFA (AAL2) is never enforced server-side → admin MFA bypass

**Where:** `src/middleware/auth.js:5-28` (validates token via `getUser()` only — **verified**, no `aal` inspection), `src/routes/admin.js:19-25` (gate = `authMiddleware` + `isAdminUser`), `components/ProtectedAdminRoute.jsx` (the **only** place `require_mfa_admins` is enforced). `grep -riE "aal|assurance|amr" src/` → no matches (verified).

**Problem:** `signInWithPassword` returns a valid **AAL1** session even when TOTP is enrolled; the second factor only *upgrades* to AAL2. The backend never inspects the `aal` claim, and the admin MFA requirement lives entirely in a React component — which is not a security boundary.

**Exploit:** Attacker with a stolen admin password can't pass the web login UI (MFA prompt), so they call Supabase Auth directly with the public anon key:
```
POST https://odoglvswwymyjuwlonkf.supabase.co/auth/v1/token?grant_type=password
```
→ AAL1 token → call the admin API directly:
```
PATCH /hcgi/api/admin/users/<id>/role       { "is_admin": true }
PATCH /hcgi/api/admin/refunds/<id>          { "action": "approve" }
PATCH /hcgi/api/admin/disputes/<id>         { "action": "release" }   # real Stripe payout
```
`authMiddleware` accepts the AAL1 token and `isAdminUser` returns true — MFA fully bypassed. Same gap weakens MFA for every ordinary user with 2FA enabled on wallet/orders/private routes.

**Fix:** Enforce assurance level in `authMiddleware` (or at least the admin router): decode the JWT `aal` claim (or call `mfa.getAuthenticatorAssuranceLevel()`), and reject `aal !== 'aal2'` for admins / any user with a verified factor when `require_mfa_admins` is on. Ideally also enforce `auth.jwt()->>'aal'` in RLS on privileged tables for defense in depth.

### 3. Wallet-balance double-spend via concurrent checkout sessions (TOCTOU)

**Where:** `src/services/checkoutService.js:156-180`, `src/routes/stripe.js:247-266`, `src/services/walletService.js:89-125` (the code itself acknowledges the gap at `:91-97`).

**Problem:** The wallet-spend coupon is sized at **session-creation** from a live balance read, but the balance is only debited later in the **webhook**. Nothing reserves the balance in between.

**Exploit:** A buyer with $100 balance opens 3 concurrent checkout sessions (tabs / cart + single-item), each `useWalletBalance: true`. Each independently reads $100 and mints a coupon up to the order total. Completing all three yields ~$300 of discounts against a $100 balance; `debitWalletForOrder` posts each debit in full and only **alerts admins after the fact** — the money has already moved, and the **platform funds the shortfall** (sellers still get full proceeds).

**Fix:** Reserve/debit atomically at session creation (pending hold), or serialize wallet-funded checkout creation per user (advisory lock / single in-flight wallet session), or add a wallet ledger with `SELECT ... FOR UPDATE` reservation. At minimum re-clamp against outstanding uncommitted wallet coupons before minting a new one.

---

## Medium

### 4. `local_game_stores` public read exposes submitter PII
`20260704220001_create_local_game_stores.sql:34-37` — `FOR SELECT USING (status='approved')` with no column restriction, so `submitter_email` and `submitted_by` are readable by anyone for approved rows. **Fix:** serve the directory via a view / column grants omitting `submitter_email`/`submitted_by`, or move contact fields to an admin-only table.

### 5. One-time welcome discount reusable across concurrent checkouts
`src/services/welcomeOfferService.js:194-211`, `checkoutService.js:148-155`, `stripe.js:224-231`. `discount_redeemed_at` is set only in the webhook, so N sessions created before any completes each mint a fresh 10% coupon. Same TOCTOU class as #3 (bounded to 10% of subtotal). **Fix:** mark-redeemed / reserve at session creation, keyed uniquely per offer.

### 6. MCP JSON-RPC batch handler → request amplification DoS
`src/routes/mcp.js:83-88` does `Promise.all(body.map(handleMessage))` with **no array-length cap and unbounded concurrency**, each element running service-role Supabase queries; rate limiters count HTTP requests, not batch elements. A single 20 MB POST with ~200k `tools/call` objects fires ~200k concurrent DB queries. **Fix:** reject `body.length > 20` with `-32600`, and/or process with a small concurrency limit; optionally lower the body limit on the `/mcp` mount.

### 7. Global 20 MB JSON body limit → amplification DoS
`src/constants/common.js:6` (`BodyLimit = 20MB`) applied to `express.json()`/`urlencoded()` in `src/app.js:100,104`. No JSON endpoint needs this (uploads are multipart). Large/deeply-nested bodies spike serverless memory/CPU. **Fix:** drop JSON/urlencoded limit to ~100–256 KB; scope any large limit to specific routes.

### 8. Public-bucket SVG/HTML upload → cross-subdomain stored XSS
Frontend flows upload directly to **public** buckets with the anon key and no magic-byte check (`avatars`, `media`, `vault-images`, `events`, `categories` — e.g. `AccountProfile.jsx:100`, `ShopProductForm.jsx:101`, `EventFormModal.jsx:286`). `utils/compressImage.js:20-24,47` passes SVG/GIF through unchanged; an attacker with the anon key can also `upload()` arbitrary bytes/Content-Type directly. A stored `<script>`-bearing SVG executes when viewed on `*.supabase.co` / `img.cardpop.com.au` — cross-subdomain (not app-origin) XSS, hence Medium. **Fix:** route these uploads through the hardened backend `uploadFiles` middleware (or add server-side magic-byte validation), reject `image/svg+xml`, force a safe stored `contentType`, and ensure the CDN never serves SVG with inline disposition.

### 9. `user_verifications` INSERT doesn't constrain `status`/admin-decision fields
`20260706140841_create_user_verifications.sql:47-52` — INSERT `WITH CHECK (user_id = auth.uid())` only. A user can self-insert `status='approved'`, `name_match=true`, etc. It grants **no real verification privilege** (the trust anchor `profiles.is_verified` is service-role-only), but pollutes/misleads the admin review queue and allows unbounded inserts. **Fix:** force `status='pending'` and null admin-decision columns in the WITH CHECK, or route inserts through the service role.

---

## Low-severity findings

10. **`event_rsvps` public read** (`20260624000002:23-25`, `USING(true)`) discloses the full user↔event attendance graph via `user_id`; a `event_rsvp_counts` view already exists for public counts. **Fix:** restrict raw-row SELECT to owner+admin.
11. **PSA scraper request forgery** (`src/utils/psaScraper.js:15-16`, reached unauth via `GET /psa/cert/:certNumber`) — cert number concatenated into the fetch URL with no validation/`encodeURIComponent` (the API path in `psaApiClient.js` does this correctly). Host is a fixed literal → no full SSRF; path/query/fragment manipulation against the public PSA site only. **Fix:** `/^[A-Za-z0-9-]+$/` + `encodeURIComponent`.
12. **PayPal `/subscription/paypal/activate` ownership bypass** (`src/routes/subscription.js:154-167`) — `if (sub.custom_id && sub.custom_id !== req.user.id)` skips the check when `custom_id` is empty (latent; always set in practice). **Fix:** `if (sub.custom_id !== req.user.id) return 403`.
13. **Webhook dedup non-atomic/fail-open** (`src/routes/stripe.js:459-541`) — SELECT-then-trailing-INSERT with error-swallow; mitigated today by per-handler CAS + Stripe idempotency keys. **Fix:** `INSERT ... ON CONFLICT DO NOTHING` at the top of the handler.
14. **`/integrated-ai/stream` buffers uploads before auth** (`src/routes/integrated-ai.js:12-22`) — multer runs before the in-handler 401, buffering up to 50 MB for anon callers (other AI routes put `requireAuth` first). **Fix:** `requireAuth` before `uploadFiles`.
15. **MFA QR `dangerouslySetInnerHTML`** (`pages/account/AccountSecurity.jsx:85`) — renders Supabase-returned SVG string as live DOM. Source is trusted (not currently exploitable). **Fix:** render as `<img>` data-URI or `DOMPurify.sanitize`.
16. **User image URLs forwarded to downstream AI** (`src/routes/integrated-ai.js:24-51`) — SSRF-by-proxy if the downstream `/generate` service is on a trusted network. **Fix:** restrict client image blocks to your own `https://` storage host or drop them.
17. **Backend API CSP `unsafe-inline` + duplicated Helmet** (`src/middleware/secureHeaders.js:7`, `src/app.js:47`) — low impact (JSON responses; the user-facing HTML CSP in `vercel.json` is strong). **Fix:** consolidate to one Helmet config, drop `'unsafe-inline'` from API `scriptSrc`.
18. **Storage bucket RLS not codified** — `avatars`/`media`/`vault-images`/`events`/`categories`/`ai-images` buckets and their `storage.objects` policies are dashboard-managed (contrary to CLAUDE.md's repo-as-source-of-truth rule), so cross-user overwrite protection can't be verified from the repo. **Fix:** codify each bucket + policies as migrations, asserting `owner = auth.uid()` on INSERT/UPDATE.
19. **Trade-access guard is dead code / mis-ordered** (`src/routes/index.js:194-201`) — the `/trade` catch-all is registered after all routers and no trade router is mounted, so the documented "any `trade` path is auto-protected" contract silently doesn't hold for future routes. **Fix:** make trade protection explicit per-route middleware, or remove the dead guard.
20. **Cloudflare IP list is hand-maintained** (`src/utils/cloudflareIps.js`) — if CF adds an edge range, `req.ip` collapses many users into one rate-limit bucket (fairness degradation, not a spoofing bypass). **Fix:** periodic refresh from `cloudflare.com/ips-v4|v6` or a test asserting currency.

---

## Configuration / infrastructure (dashboard, not code)

- **Supabase Auth: leaked-password protection is DISABLED** (Security Advisor `auth_leaked_password_protection`). Enable HaveIBeenPwned checks — Auth → Policies. Easy win.
- **`SECURITY DEFINER` RPCs executable by `anon`/`authenticated`** (advisor `0028`/`0029`): `admin_set_featured_seller`, `accept_trade`, `enforce_listing_approval`, `email_verification_ok`, `first_banned_word`, `flag_banned_words_*`, `sync_vault_estimated_value_from_listing`. `admin_set_featured_seller` was **verified** to have a correct internal `auth.uid()`+`is_admin` gate (its `revoke ... from anon` apparently didn't take effect in production — re-apply). The trigger functions are exposed as RPC unnecessarily. **Fix:** `REVOKE EXECUTE ... FROM anon, authenticated` on the trigger/internal functions; keep the internal authz gate as the real control.
- **Two RLS-enabled-no-policy tables** (`data_deletion_requests`, `launch_registrations`) — intentional service-role-only deny-all. No action needed; confirm intent.

---

## Verified-correct (no action needed — highlights)

Server-authoritative cart/checkout pricing; Stripe webhook signature verification (raw body, hard-fail on missing sig/secret); refund amounts recomputed server-side & admin-gated; order double-processing guarded by unique `stripe_session_id` + status CAS; `event-scraper.js` DNS-rebinding-safe SSRF defense; `file-upload.js` magic-byte validation; Facebook data-deletion HMAC with `timingSafeEqual` (fails closed); `mcp.js` read-only service-role queries filtered to public rows with `.or()`/LIKE injection sanitized; core marketplace RLS (`orders`, `offers`, `messages`, `trades`, `notifications`, `vault_items`, `listings`) confirmed live and correct; profile-write locking of `is_admin`/financial columns; `handle_new_user()` safe; Stripe Wrapper foreign-table grants already revoked; `npm audit` clean (0/819); no hardcoded secrets; service-role key never bundled client-side; CORS restricted (no wildcard-with-credentials); trust-proxy config not spoofable.

---

## Suggested remediation order

1. **#1 (Critical, profiles reads)** — ship a column-grant migration + narrow the three unauthenticated `select('*')` client reads.
2. **#2 (High, server-side AAL2)** — gate the admin router on `aal='aal2'`; extend to all authed routes.
3. **#3 (High, wallet double-spend)** — atomic reservation at session creation.
4. Medium DoS/exposure items **#4–#9**, then the Low items and the dashboard config toggles (leaked-password protection is a 1-click win).
