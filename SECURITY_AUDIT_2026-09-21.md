# Security Audit — 2026-09-21

Adversarial, full-surface review of CardPop: the Express API (every router,
middleware and service), the React SPA, all 178 Supabase migrations **and the
live database's actual policies, grants, SECURITY DEFINER functions, storage
buckets and security advisors** (inspected read-only through the Supabase
API), the Vercel/Cloudflare edge configuration, GitHub Actions, secrets (working
tree and full git history) and the dependency tree.

Method: four independent reviewers each took one attack surface
(authorization/IDOR; database RLS; injection/SSRF/XSS/uploads; auth flows,
crypto, secrets and payments). Every finding below was then re-verified by
reading the code, and the two guard bypasses were confirmed with a local proof
of concept before being fixed. Findings are ordered by severity. Each says
whether it is **fixed in this branch** or **left for a decision**, and why.

The previous audits (2026-07-15, -21, -30) had closed the obvious classes:
token validation, admin checks, webhook signatures, CAS-based fulfilment,
server-derived prices. What remained was one logic hole in a newer feature
(offers), authorization *depth* (MFA enforced on admins but not on sellers'
money), two guard bypasses, and operational risk in CI.

---

## Summary

| # | Severity | Finding | Status |
|---|---|---|---|
| C-1 | **Critical** | Buy any active listing for $1 via an offer whose `seller_id` is attacker-chosen | Fixed (code + migration) |
| H-1 | High | MFA is UI-only for sellers: an AAL1 (password-only) token can open the Stripe Express dashboard, change the payout bank and withdraw the wallet | Fixed |
| H-2 | High | A one-shot workflow that runs `drop schema public cascade; truncate auth.users` against the **production** project was still armed on a push to a branch name | Fixed (removed) — secrets to rotate |
| H-3 | High | SSRF guard bypass: bracketed IPv6 / hex IPv4-mapped literals skip both layers of the guard | Fixed |
| M-1 | Medium | Forge an "offer received" notification + branded email to any user (same root cause as C-1) | Fixed |
| M-2 | Medium | Admin routers `blog`, `event-scan`, `GET /reports` and the manual scan trigger skipped the MFA step-up | Fixed |
| M-3 | Medium | Sentry received request bodies and headers on every 5xx (passwords, bearer tokens) | Fixed |
| M-4 | Medium | Service-role password-reset endpoint bypassed CAPTCHA (email bombing), unused by the frontend | Fixed (removed) |
| M-5 | Medium | Stripe/Connect/PayPal return URLs taken verbatim from the body → phishing redirect after a genuine payment | Fixed |
| M-6 | Medium | `charge.dispute.created` not idempotent: a redelivered event claws back the seller a second time | Fixed |
| M-7 | Medium | `/auth/password/change` brute-forceable (no per-user limit) and leaks a session per call | Fixed |
| M-8 | Medium | 10 vulnerable production dependencies incl. reachable multer DoS and sharp libheif overflow | Fixed |
| M-9 | Medium | `safeFetch` read an unbounded body after clearing its timeout | Fixed |
| M-10 | Medium | `trust proxy` hop-walk may resolve the wrong client IP behind Vercel | Decision needed |
| L-1 | Low | Workflows without `permissions:`; `snyk/actions@master`; unpinned `curl \| bash` | Mostly fixed |
| L-2 | Low | `validateRequestBody` merged instead of replaced — stripped keys survived into service-role writes | Fixed |
| L-3 | Low | `GET /cardsight/status` echoed the first six characters of the API key to anyone | Fixed |
| L-4 | Low | `escapeLike` missed PostgREST's `*` wildcard alias | Fixed |
| L-5 | Low | `javascript:` URLs accepted in profile/event/show link fields (blocked by CSP today) | Decision needed |
| L-6 | Low | Any signed-in user can write "confirmed" rows into the shared `card_catalogue` | Decision needed |
| L-7 | Low | Backup codes have no consumer — lockout risk and false assurance | Decision needed |
| L-8 | Low | Admin event insert spreads the raw body into `events` | Decision needed |
| L-9 | Low | Supabase "leaked password protection" is off; `get_user_event_rsvps` lists any user's RSVPs to anon | Decision needed |
| I-1 | Info | `trusted-types 'allow-duplicates' *` still in the CSP (flagged 2026-07-30) | Decision needed |
| I-2 | Info | In-memory limiters are per-instance; contact/newsletter bot checks fail open until their secrets are set | Documented |

---

## C-1 — Critical: buy any listing at a self-chosen price (fixed)

**Where:** `src/routes/offers.js` (POST `/offers`), `src/services/checkoutService.js`
(`resolveOfferPrice`), `src/routes/stripe.js` (`/calculate`), and the
`offers` INSERT policies.

**What was wrong.** `POST /offers` wrote `seller_id` straight from the request
body. The only check was `sellerId !== buyerId`. The database did not tie it to
the listing either: the permissive INSERT policy checks `buyer_id = auth.uid()`
and the restrictive one only that the listing is active. Checkout then trusted
the offer's *status*: `resolveOfferPrice` verified the offer belonged to the
buyer and the listing and was `accepted`/`countered` — but never that the
account that accepted it was the listing's owner.

**The attack** (two free accounts, A and B; A ID-verified so it may buy):

1. A: `POST /api/offers {"listingId": "<victim's listing>", "sellerId": "<B>", "amountAud": 1}` → 201.
2. B accepts it from the normal Offers page (RLS lets the row's `seller_id` move `pending → accepted`).
3. A: `POST /api/stripe/create-checkout {"listingId": …, "offerId": …}` → priced at $1.
4. A pays $1 + fees. The webhook's amount check passes (it recomputes from the same $1), `claimListingSold` flips the victim's listing to `sold`, the order row names the real seller with `seller_proceeds ≤ 0`, and the victim gets a "your card sold" email.

**Fix (three layers, so the browser path and the API path are both closed):**

- `POST /offers` now loads the listing with the service client and writes
  `listings.seller_id`; a body `sellerId` is accepted only when it matches,
  and an inactive/unknown listing is a 404.
- `resolveOfferPrice` takes the listing's seller and refuses any offer whose
  `seller_id` differs (both checkout and the `/calculate` preview pass it).
- Migration `20260921210000_offers_bind_seller_to_listing.sql`: a BEFORE
  INSERT trigger that overwrites `seller_id` with the listing's seller (all
  roles), plus a restrictive INSERT policy so a direct PostgREST insert with
  the wrong seller fails RLS.

The live `offers` table had **zero rows** at audit time, so there is nothing
to clean up. Tests: `tests/backend/offers.test.js`, `tests/backend/stripe.test.js`
("rejects an accepted offer whose seller is not the listing seller").

## H-1 — MFA enforced on admins but not on sellers' money (fixed)

`requireAal2` existed and was mounted on `/admin` and the `requireAdmin`
routes. Everything else validated tokens with `supabase.auth.getUser()`, which
accepts an AAL1 token — so for ordinary users the "MFA required" rule lived
only in `AuthContext.jsx`. With a phished or stuffed password an attacker mints
an AAL1 token directly at `…/auth/v1/token?grant_type=password` and calls:

- `POST /stripe/connect/dashboard-link` → Stripe Express login link → change the payout bank account;
- `POST /stripe/connect/withdraw` → push the held wallet balance to it;
- `POST /auth/password/change` (current password known) and `POST /auth/backup-codes/generate` → lock the real owner out.

**Fix:** `requireAal2` is now on `/stripe/connect/{onboard,dashboard-link,withdraw}`,
`/wallet/{topup,save-card}`, `/auth/password/change` and
`/auth/backup-codes/generate`. It only rejects users who have a verified MFA
factor, so nobody without MFA is affected, and MFA users already complete the
challenge in the UI before those pages render.

## H-2 — Production-wipe workflow armed on a branch push (fixed; secrets to rotate)

`.github/workflows/db-region-migrate.yml` (the Tokyo → Sydney region move)
triggered on `workflow_dispatch` **or** a push to
`claude/db-migration-sydney-4yla6k` touching `.github/db-region-migrate.trigger`,
and its load step began with `drop schema if exists public cascade; …
truncate auth.identities, auth.users cascade;` against `NEW_REF:
vrfsaazuqjxotnieqlkd` — the live project. The workflow was on `main` and that
branch still exists on the remote, so anyone with push rights (or any
compromised token in another workflow) could wipe production and reload it
from the months-stale Tokyo dump.

**Fix:** workflow and trigger file deleted. **Still to do in GitHub/Supabase
(cannot be done from the repo):** delete the repo secrets
`SUPABASE_DB_PASSWORD_TOKYO`, `SUPABASE_DB_PASSWORD_SYDNEY`,
`SUPABASE_SERVICE_ROLE_KEY_TOKYO`, `SUPABASE_SERVICE_ROLE_KEY_SYDNEY`, then
rotate the Sydney database password and service-role key (they were exposed to
a broadly-triggerable job) and update `SUPABASE_DB_PASSWORD` /
`SUPABASE_SERVICE_ROLE_KEY` in Vercel and Actions. Delete the stale
`claude/db-migration-sydney-4yla6k` branch.

## H-3 — SSRF guard bypass via IPv6 literals (fixed)

`assertNotLiteralPrivateAddress` read `new URL(url).hostname`, which for
`http://[::1]/` is the string `"[::1]"` — brackets included. `net.isIP()`
doesn't recognise that, so the URL was treated as a *hostname* and only
compared against the string `localhost`. undici then strips the brackets and
connects to the IP directly, and Node never runs the custom `lookup` for IP
literals, so the second guard (`ssrfSafeLookup`) never saw it either. The
WHATWG parser also normalises `[::ffff:127.0.0.1]` to hex (`::ffff:7f00:1`),
which the string-prefix `isPrivateIp` did not understand.

Confirmed locally: `http://[::1]/`, `http://[::ffff:127.0.0.1]/`,
`http://[::ffff:169.254.169.254]/`, `http://[fe80::1]/`, `http://[fd00::1]/`
all passed the guard. Reachable without an account: the nightly event scanner
fetches web-search result URLs and follows their redirects.

**Fix:** hosts are unbracketed before classification and `isPrivateIp` now
parses with `ipaddr.js` (every special-purpose range, IPv4-mapped unwrapping,
NAT64 embedding, fail-closed on garbage); `*.localhost` is blocked too. The
body read now stays under the timeout and is capped at 2 MB (M-9). Tests:
`tests/backend/utils/safeFetch.test.js`.

## M-1 — Forged "offer received" email to any user (fixed)

Same root cause as C-1: one account could `POST /offers` naming any user id as
`sellerId`; the `on_offer_created` trigger wrote them a notification and the
route emailed them from `noreply@cardpop.com.au` with the attacker's 1,000-char
message. Closed by the seller derivation above.

## M-2 — Admin surfaces without the MFA step-up (fixed)

`src/routes/blog.js`, `src/routes/event-scan.js`, `GET /reports` and the
manual "Run scan now" path in `api/event-scan.js` used a bare `isAdminUser()`.
They now use `requireAdmin` (admin + AAL2); the standalone function performs
the same `listFactors` check and fails closed.

## M-3 — Sentry PII (fixed)

`Sentry.init` had no `beforeSend` and the default request-data integration, so
`setupExpressErrorHandler` shipped the JSON body and every header on each 5xx —
e.g. a throw after `updateUserById` in `/auth/password/change` sent
`{ currentPassword, newPassword }` plus `Authorization: Bearer …`. Now
`sendDefaultPii: false`, the integration excludes body/cookies/headers/IP, and
`scrubSentryEvent` filters secret-shaped keys and collapses `user` to its id.

## M-4 — CAPTCHA-free password reset (fixed)

`POST /auth/password/reset/request` called `resetPasswordForEmail` on the
**service-role** client; GoTrue skips CAPTCHA for service-role requests, so
this was a way to fire reset emails at any address with only a 3/hour per-IP
limiter (rotate IPs to bomb one victim). The frontend never used it (it resets
straight through Supabase with a Turnstile token). Removed.

## M-5 — Open redirect through Stripe/Connect/PayPal return URLs (fixed)

`successUrl` / `cancelUrl` / `returnUrl` / `refreshUrl` were validated only for
presence (or `z.string().url()`). An attacker could create a Checkout Session
whose `success_url` was their own site, hand the `checkout.stripe.com` link to
a victim, and receive them (with the `session_id`) after a real payment.
`src/utils/returnUrl.js` now pins every such URL to `APP_URL`, `CORS_ORIGIN`,
Vercel's deployment URL or `CHECKOUT_RETURN_ORIGINS`; applied to single-item
and cart checkout, wallet top-up/save-card, subscriptions (Stripe + PayPal) and
Connect onboarding. The frontend already builds these from
`window.location.origin`.

## M-6 — Dispute handler idempotency (fixed)

The webhook's event dedupe is fail-open and Stripe redelivers on any non-2xx,
so `handleDisputeCreated` could run twice for one dispute and reverse the
seller payout again (for cart orders the per-line payout status wasn't
updated, so the wallet clawback repeated and took money from unrelated sales).
It now short-circuits when a `payment_disputes` row with that
`stripe_dispute_id` exists (UNIQUE).

## M-7 — Password change hardening (fixed)

Per-user `PgRateLimitStore('pwchange')` limiter (5 / 15 min), the verifying
anon client no longer persists sessions or starts refresh timers, and the
route sits behind `requireAal2`.

## M-8 — Dependencies (fixed)

`npm audit fix` (no `package.json` change, lockfile only): `multer` 2.2.0 →
2.4.0 (three DoS advisories, reachable on every upload route), `sharp` 0.35.2 →
0.35.4 (libheif heap overflow — sharp sniffs bytes, so a HEIC renamed `.jpg`
passed the MIME allow-list), `morgan` 1.11 → 1.12.1 (log forging), `qs` →
6.16 (DoS via `express.urlencoded`), plus `ip-address`, `react-router`,
`dompurify`. `npm audit --omit=dev` now reports 0.

## M-10 — Client-IP derivation behind Vercel (decision needed)

`src/app.js` trusts hop 0 and then any Cloudflare address. Whether that yields
the real visitor depends on whether Vercel *appends to* or *overwrites*
`x-forwarded-for` (Vercel documents that it overwrites and exposes
`x-vercel-forwarded-for` for proxied setups). If it overwrites, every IP-keyed
limiter and the login lockout key on a few hundred shared Cloudflare edge IPs.
If it appends, a direct-to-origin request can push a Cloudflare IP into the
chain and pick its own `req.ip`. Recommended: log `req.ip` next to
`cf-connecting-ip` for a day in production; then derive the client IP
explicitly (use `cf-connecting-ip` only when the immediate peer is Cloudflare,
otherwise the peer) and reject requests that don't arrive via Cloudflare (a
Transform Rule header, or Vercel's "trusted proxy" setting) so `*.vercel.app`
can't bypass the WAF. Not changed here because the correct rule depends on
production header behaviour I could not observe from this sandbox.

## L-1 — GitHub Actions hygiene (mostly fixed)

Added `permissions: contents: read` to `ci`, `main-ci`, `supabase-migrations`,
`image-maintenance` and the four `cron-*` callers; pinned
`snyk/actions/node@master` → `@0.4.0`. Left: `git-backup.yml` still installs
rclone with `curl … | sudo bash` (pin to a release + checksum), and actions are
tag-pinned rather than SHA-pinned.

## L-2 … L-4 (fixed)

- `validateRequestBody` now assigns the parsed result (`req.body = validated`)
  instead of `Object.assign`, so keys zod strips can no longer reach a
  service-role `insert(...spread)` (`admin.js` business-profile routes).
- `GET /cardsight/status` no longer returns a key prefix.
- `escapeLike` strips `*` (PostgREST treats it as `%`, and `\*` becomes `\%`).

## L-5 — `javascript:` URLs in link fields (decision needed)

Profile `social_links`, event URLs (`eventData.js` accepts any scheme, including
model-emitted values), Whatnot show URLs and business-profile `website_url`
are stored raw and rendered into `href` / `window.open`. The hash +
`strict-dynamic` CSP blocks `javascript:` navigation today, so this is
defence-in-depth: add one `safeHttpUrl()` (`/^https?:$/`) at write time and
render time, and `check (url ~* '^https?://')` constraints. Not changed: it
touches ~8 UI files and a schema decision.

## L-6 — Shared `card_catalogue` writable by any account (decision needed)

`POST /card-scans` and `PATCH /card-scans/:id` call `record_catalogue_observation`
(service role) with client-supplied identity fields, the PATCH path with
`p_confirmed = true`. Poisoned rows feed public `/catalog/search` suggestions.
Options: only promote from server-side identification results, require N
independent observations, or moderate `confirmed` rows.

## L-7 — Backup codes have no consumer (decision needed)

`/auth/backup-codes/verify` requires an already-authenticated session and just
returns `success`; nothing in the Supabase TOTP flow accepts a backup code, yet
`SecuritySettingsPage.jsx` tells users to save them. Either remove the feature
or implement a real recovery path (server-side code check →
`auth.admin.mfa.deleteFactor`, gated by password re-auth). The crypto itself
(random codes, timing-safe compare, PG-backed limiter, single use) is fine.

## L-8 — Admin event insert spreads the raw body (decision needed)

`src/routes/event-scraper.js` `create-event-from-data` inserts
`{ ...eventData, status: 'pending_review' }` with the service client, so an
admin can set any column (`is_featured`, `auto_discovered`, `created_by`). Admin-
only; run `validateAndNormalizeEventData` on it like the nightly path does.

## L-9 — Supabase dashboard items (decision needed)

- Auth → "Leaked password protection" is **off** (advisor warning). Turn it on.
- `get_user_event_rsvps(profile_id)` is SECURITY DEFINER and callable by
  `anon`: anyone can list any user's RSVPs to approved events. Revoke from
  `anon` or filter to `auth.uid()`.
- Advisor lists 16 SECURITY DEFINER *trigger* functions as anon-executable;
  trigger-returning functions cannot be invoked via RPC, so this is noise, but
  `revoke execute … from anon, authenticated` on them is harmless hygiene.
- `stripe.*` functions with mutable `search_path` belong to the Stripe Sync
  Engine integration; leave them.

## I-1 — Trusted Types wildcard (decision needed)

`vercel.json` still ships `trusted-types 'allow-duplicates' *`. The default
policy still guards accidental sinks, but `*` lets any script gadget mint its
own policy. Tighten to the enumerated policy names once the third-party
scripts' policy names are known (GTM, Stripe, Cloudflare challenge).

## I-2 — Rate limiting model (documented)

`globalRateLimit`, `apiLimiter` and `stripeLimiter` use the in-memory store and
reset per serverless instance; only the security-sensitive limiters are
PG-backed. Cloudflare is the volumetric layer. `/contact` (Turnstile) and
`/newsletter` (reCAPTCHA) fail **open** until `TURNSTILE_SECRET_KEY` /
`RECAPTCHA_SECRET_KEY` are set in Vercel — the only signal is a warn log, so
confirm both are set.

---

## Verified sound (no change)

- **Tokens:** every path validates with `supabase.auth.getUser(token)`; nothing trusts an unverified JWT; `decodeAal` only reads a claim from an already-validated token.
- **Admin:** `isAdminUser` uses server-set `app_metadata.is_admin` or `profiles.is_admin`, never `user_metadata` or `user.role`.
- **Stripe webhook:** raw body + `constructEvent`, 500 when the secret is unset, event dedupe, per-handler compare-and-swap on `orders.status` / `listings.status`, `amount_total` cross-checked against server-written figures with auto-refund on mismatch, `metadata.userId` only ever written server-side.
- **Checkout:** prices from `listings` / `shop_products`, never the body; `transactionType` / `bidId` ignored; self-purchase blocked; quantities floored at 1; cart capped at 50; Australia-only gate before geocode.
- **Wallet / payouts / refunds / points / welcome offer:** atomic RPCs with idempotency keys; refunds admin-only with order-scoped keys; one points claim per UTC day; welcome offer once per user with CAS reservation.
- **Crypto:** AES-256-GCM with random IV and verified tag, key derived from a ≥32-char `ENCRYPTION_KEY`, fail-closed at boot; OTP/backup codes from `crypto.randomInt` / `randomBytes`; Facebook `signed_request` and all four `CRON_SECRET` checks use `timingSafeEqual` and fail closed.
- **Secrets:** none in the working tree or in any of the 80 commits (only public anon keys, Sentry DSNs and dummy test JWTs); `.env*` never tracked; every `VITE_*` value is public-appropriate.
- **Injection:** every `.or()` / `.ilike()` sink is constant, bound, or goes through `orFilterTerm` / `escapeLike` / `cardSearchFilter`; no raw SQL; no `child_process`, `sendFile` or user-controlled `fs` paths.
- **XSS:** `dangerouslySetInnerHTML` only on DOMPurify + Trusted-Types output; `api/prerender.js` escapes every interpolation; `api/sitemap.js` XML-escapes; iframes from allow-listed parsers.
- **Uploads:** Content-Type gate + `file-type` magic bytes, bounded sizes, server-generated keys, client storage paths pinned to `<userId>/`; every public bucket has an image MIME allow-list and a size cap (`verification-docs` private, `ai-images` service-role read).
- **Service worker:** API and cross-origin requests untouched; only public storage images cached.
- **MCP endpoint:** read-only tools over active listings, batch-capped, inputs sanitised.
- **Live RLS state:** every `public` table has RLS enabled; the six tables with no policies are deny-all by design; `profiles` uses column-level grants; `user_security` is service-role only; `profiles_update_access` pins every privileged column (`is_admin`, `legal_name`, `wallet_balance_aud`, subscription and Stripe ids, …).

## Not verifiable from this sandbox

Outbound requests to `cardpop.com.au` are blocked by the sandbox's network
policy, so live response headers, the WAF, and Vercel's `x-forwarded-for`
behaviour (M-10) were not observed directly; header/CSP conclusions come from
`vercel.json` and `secureHeaders.js`.

## Actions for you (outside the repo)

1. Delete the four `SUPABASE_*_TOKYO/SYDNEY` Actions secrets; rotate the Sydney DB password and service-role key; delete the `claude/db-migration-sydney-4yla6k` branch (H-2).
2. Enable **Leaked password protection** in Supabase Auth (L-9).
3. Confirm `TURNSTILE_SECRET_KEY` and `RECAPTCHA_SECRET_KEY` are set in Vercel (I-2).
4. Decide on M-10 after observing production headers.
5. Merging this branch applies `20260921210000_offers_bind_seller_to_listing.sql` through the migrations workflow — check the Actions run is green.
