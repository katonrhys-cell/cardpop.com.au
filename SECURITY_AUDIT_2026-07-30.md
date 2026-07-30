# Security Audit — 2026-07-30

Full-surface review of the CardPop application: Express API (43 routers, 15
middleware, 16 services, 92 utils), React SPA, 141 Supabase migrations, the
live database's RLS policies and storage configuration, CSP/headers, the
Vercel/Cloudflare edge configuration, and dependencies.

The live Supabase project was inspected read-only (policy catalogue, grants,
storage buckets, security advisors) because storage policies and some grants
exist **only** in the dashboard and are therefore invisible to a repo-only
review. That gap is itself a finding (L-6).

Findings are ordered by severity. Each says whether it is **fixed in this
branch** or **left for a decision**, and why.

---

## Summary

| # | Severity | Finding | Status |
|---|---|---|---|
| H-1 | High | SSRF: redirect chain bypasses the private-address guard entirely | Fixed |
| H-2 | High | Any signed-in user can read every other user's AI/OCR uploads (`ai-images` bucket) | Fixed (migration) |
| M-1 | Medium | `profiles.legal_name` is self-writable — forges the ID-document name behind both anti-fraud name checks | Fixed (migration) |
| M-2 | Medium | Admin affiliate scraper follows redirects with no SSRF guard at all | Fixed |
| M-3 | Medium | Unauthenticated search suggestions leak private vault contents | Fixed |
| M-4 | Medium | `vault-images` public bucket accepts any MIME type, any size | Fixed (migration) |
| M-5 | Medium | `trusted-types *` wildcard defeats the Trusted Types CSP | Decision needed |
| L-1 | Low | `media` bucket permits `image/svg+xml` (stored-XSS shape, admin-only write) | Decision needed |
| L-2 | Low | `react-router` 7.12–8.2 advisory GHSA-qwww-vcr4-c8h2 | Not applicable, tracked |
| L-3 | Low | Brute-force lockout is client-driven and trivially bypassed | Accepted risk, documented |
| L-4 | Low | IP rate limiters are per-instance in a serverless runtime | Accepted risk, documented |
| L-5 | Low | Trade-route auto-protection in `routes/index.js` is dead code | Documented |
| L-6 | Low | Storage policies live only in the dashboard; two of them contradict the code | Documented |
| L-7 | Low | `event-scraper` spreads unvalidated `eventData` into the insert | Documented |
| L-8 | Low | Turnstile fails open when `TURNSTILE_SECRET_KEY` is unset | By design, verify it is set |

**Nothing was found in the areas most likely to lose money.** Checkout prices
every line server-side from the source of truth and never trusts a client
total; the Stripe webhook verifies signatures, dedupes by event id, and
compare-and-swaps every fulfilment claim; refund amounts are recomputed from
the order row rather than the buyer-created refund row; `can_sell` and every
financial column on `profiles` are pinned against self-writes. Every table in
`public` has RLS enabled, and no INSERT/UPDATE/DELETE policy anywhere grants
an unscoped write.

---

## H-1 — SSRF: the private-address guard covers only the first hop

**Where:** `src/utils/safeFetch.js` → `fetchWebpageContent()`
**Reached by:** `src/utils/eventScanner.js` (nightly, unattended) and
`src/routes/event-scraper.js` (admin panel)

`fetchWebpageContent` has two layers of SSRF protection:

1. `assertNotLiteralPrivateAddress(url)` — rejects IP-literal and `localhost` hosts.
2. `ssrfSafeDispatcher` — a custom undici `lookup` that validates the resolved
   address *as* the lookup the socket connects with, closing the DNS-rebinding
   window.

Layer 2 does not apply to IP literals. Node's `net.connect` skips the `lookup`
callback entirely when the host is already an IP, so the dispatcher never runs
for `http://169.254.169.254/`. That is exactly why layer 1 exists — but layer 1
ran only on the URL passed in, while `undiciFetch` followed redirects itself
(`redirect: 'follow'` is the fetch default). **A page that answers `302
Location: http://169.254.169.254/…` was fetched with no check at all.**

Verified experimentally against the real `ssrfSafeLookup` and undici:

```
IP-literal fetch => 200 SECRET-INTERNAL-DATA | lookup called: 0
followed redirect => 200 AWS-METADATA-CREDENTIALS  (redirected: true)
```

The nightly event scanner is the exposed path: it fetches URLs harvested from
**web-search results**, with no human in the loop. An attacker who gets a page
into the results for the scanner's queries (Australian trading-card events)
controls the redirect. Fetched content is fed to Claude for extraction and
written to `event_scan_candidates` / `events` for admin review, so responses —
and error text from failed connections — come back out, making both
exfiltration and internal port-scanning practical.

**Fix (applied):** redirects are followed by hand, one hop at a time, with
`assertNotLiteralPrivateAddress` re-applied to every hop, a non-HTTP(S) scheme
check on each `Location`, and a 5-redirect ceiling. Three regression tests
added in `tests/backend/event-scraper.test.js`.

## H-2 — Cross-tenant read of every user's AI and card-scan uploads

**Where:** `storage.objects` policies `ai_images_auth_select` /
`ai_images_auth_insert` (dashboard-created)

The `ai-images` bucket holds every photo a user sends through the AI assistant
and the card-identification pipeline (`src/api/integrated-ai.js` →
`uploadImagesToSupabase`, keyed `ocr/<random>.<ext>`). The bucket is private,
but both policies were scoped to the bucket rather than the object owner:

```
ai_images_auth_select  SELECT  to authenticated  USING (bucket_id = 'ai-images')
ai_images_auth_insert  INSERT  to authenticated  WITH CHECK (bucket_id = 'ai-images')
```

With the anon key that ships in the frontend bundle, any signed-in user could:

```js
supabase.storage.from('ai-images').list('ocr')                  // enumerate
supabase.storage.from('ai-images').createSignedUrl(path, 3600)  // download
```

The random object name is not a defence once the bucket is listable. The INSERT
policy likewise let any signed-in user write arbitrary objects into the bucket.

Nothing needs either grant: every read and write of `ai-images` goes through the
Express backend's service-role client, and a repo-wide search for
`storage.from('ai-images')` finds only `src/api/integrated-ai.js` — no browser
code touches it.

**Fix (applied):** `supabase/migrations/20260730202000_restrict_ai_images_bucket_access.sql`
drops both policies, leaving the bucket service-role-only.

## M-1 — `profiles.legal_name` is self-writable

**Where:** `profiles_update_access` policy (last set in `20260720150000`)

`legal_name` is the name read off the user's **identity document**, written only
by `identityService.applyIdentitySession()` from the Stripe Identity result. It
is already unreadable by the browser (`20260715210000` left it out of the
column-level SELECT grant) — but nothing stopped a user *writing* it. `profiles`
carries a table-wide UPDATE grant for `authenticated`, and the self-update
branch's `WITH CHECK` pins 24 financial/identity columns; `legal_name` was not
among them:

```js
supabase.from('profiles').update({ legal_name: 'Their Display Name' }).eq('id', self)
```

That forges the input to both name cross-checks:

- **Admin identity-mismatch review** (`GET /admin/users/:userId/stripe-names`)
  displays `legal_name` as "ID document" and computes
  `namesMatch(display_name, legal_name)` for the reviewing admin. A user flagged
  for a mismatch could make the panel report a clean match, steering the admin
  toward granting the Verified badge on a document that never matched.
- **Connect payout sync** compares the KYC'd payout name against
  `legal_name || display_name` to maintain `payout_name_mismatch` — a self-set
  `legal_name` suppresses that flag.

`is_verified`, `verification_status`, `identity_name_mismatch` and
`payout_name_mismatch` were all already pinned, so this is not direct
self-verification: it degrades the human review those flags exist to trigger.

**Fix (applied):** `supabase/migrations/20260730201900_lock_profiles_legal_name.sql`
adds `legal_name` to the pin list.

## M-2 — Admin affiliate scraper had no SSRF guard on redirects

**Where:** `src/routes/admin.js` → `POST /admin/affiliate-metadata`

The endpoint allow-lists Amazon hosts, then called the global `fetch` with
`redirect: 'follow'`, no dispatcher, and no private-address check. The
allow-list applied only to the first hop — and two allow-listed hosts
(`amzn.to`, `a.co`) are URL shorteners whose entire purpose is to redirect. Any
open redirect on an Amazon property, or a shortener target, chained into an
unguarded fetch of an arbitrary URL including internal addresses. Admin-only, so
it needs an authenticated admin session, which is why this is Medium not High.

**Fix (applied):** manual redirect following with the host allow-list, the
https-only check, and `assertNotLiteralPrivateAddress` re-applied per hop,
routed through `ssrfSafeDispatcher`, capped at 5 hops.

## M-3 — Search suggestions leak private vault contents

**Where:** `src/routes/search-suggestions.js`

This router is unauthenticated and uses the **service-role** client (RLS
bypassed). All three of its `vault_items` queries selected `card_name` with no
`is_public` filter, so an anonymous caller received card names from every user's
private vault — and `?q=` two letters at a time walks the whole table. The
`didYouMean` fuzzy pool pulled 500 rows the same way.

**Fix (applied):** all three queries scoped to `.eq('is_public', true)`,
mirroring the public branch of the `vault_items` SELECT policy.

## M-4 — `vault-images` accepts arbitrary files of arbitrary size

**Where:** `storage.buckets` row for `vault-images`

The bucket is `public: true`, writable by any authenticated user under their own
uid folder, with `file_size_limit = null` and `allowed_mime_types = null` —
while every other image bucket carries both limits. It therefore doubled as
unmetered, publicly-served file hosting for arbitrary content on a
`supabase.co` URL, on a plan where storage egress is the metered resource
(the whole reason `docs/image-cdn.md` exists).

Note the bucket's `public: true` flag also means its two SELECT policies
("Owners can access their own vault images", "Public vault item images are
viewable by everyone") are inert — public buckets bypass RLS on read, so every
object is world-readable by URL regardless. That appears intentional (see the
comment in `VerificationSubmissionPage.jsx`), but it is worth being explicit
about: images attached to *private* vault items are readable by anyone with the
URL.

**Fix (applied):** the migration sets a 20 MB cap (matching the `events` bucket)
and an image-only MIME allow-list. Client-side compression already emits
webp/jpeg, and the one bypass path (`compressImage` skips SVG and GIF) means
this newly rejects SVG uploads — which is the desired outcome, not a regression.

## M-5 — `trusted-types *` defeats the Trusted Types policy — decision needed

**Where:** `vercel.json`, both CSP headers

```
require-trusted-types-for 'script'; trusted-types 'allow-duplicates' *;
```

The `*` allows **any** script to create **any** named Trusted Types policy. An
attacker with a script-execution foothold simply mints their own policy and
writes to `innerHTML` unimpeded, so the DOMPurify-backed `default` policy in
`lib/trustedTypesPolicy.js` is bypassable and `require-trusted-types-for` buys
close to nothing.

**Not fixed here, deliberately.** The correct value is an explicit list, but it
must include every policy name created by third-party scripts at runtime, and
this page loads Google Tag Manager, AdSense, Google Maps JS (which creates
`goog#html`) and Sentry. Guessing that list on a live storefront risks breaking
ads, analytics and checkout autocomplete. Recommended sequence:

1. Ship the tightened directive in a `Content-Security-Policy-Report-Only`
   header alongside the enforcing one.
2. Collect the `trusted-types-sink`/policy-creation violations for a few days.
3. Replace `*` with `default` plus whatever names showed up.

## L-1 — `media` bucket permits SVG uploads

`media` is `public: true` and its `allowed_mime_types` includes
`image/svg+xml` (and `application/pdf`). An SVG is an active document: served
from a public URL — and, once `VITE_IMAGE_CDN_HOST` is on, from
`img.cardpop.com.au`, a **subdomain of the app's own registrable domain** — it
can run script and set cookies scoped to `.cardpop.com.au`.

Write access is `media_admin_all` (admins only), which is why this is Low. Left
unchanged because admin media uploads may legitimately use SVG (logos, icons);
removing the type is a one-line change to the same migration if you confirm
they don't.

## L-2 — `react-router` advisory

`npm audit` reports GHSA-qwww-vcr4-c8h2 (High) against `react-router`
7.12.0–8.2.0: an RSC-mode CSRF bypass allowing action execution before a 400
response. **Not applicable here** — this is a client-side SPA using
`react-router-dom` with no RSC/server-actions mode. The remediation
(`npm audit fix --force`) downgrades to 7.11.0, a breaking change, for no real
gain. Track it and take the fixed release when it lands rather than downgrading.

## L-3 — Brute-force lockout is client-driven

`POST /auth/login/attempt` and `POST /auth/login/record-failure` are
unauthenticated advisory endpoints the login page calls around its own
`signInWithPassword`. An attacker authenticating directly against Supabase Auth
never calls them, so the `(email, ip)` lockout in `login_attempts` never
increments. Supabase's own auth rate limits and Cloudflare are the real control.
Keyed on `(email, ip)` means it also can't be used to lock a victim out from
their own IP, which is the right trade-off. Worth knowing that the table is
telemetry, not a control.

## L-4 — IP rate limiters are per-instance

`globalRateLimit` (50/5min) and `apiLimiter` (100/min) use
`express-rate-limit`'s in-memory store. On Vercel each concurrent serverless
instance keeps its own counter, so the effective cap is `N × limit`. The
security-sensitive limiters (login, password reset, backup codes, HIBP proxy,
verification resend, welcome offer, email-existence) already use the shared
Postgres store via `PgRateLimitStore` — the right ones are covered. Cloudflare
remains the authoritative volumetric layer, as documented in
`docs/ddos-protection.md`.

## L-5 — Trade-route auto-protection is dead code

`src/routes/index.js` ends with a `router.use` that applies `authMiddleware` +
`verifyTradeAccess` to any path starting with `/trade`. Express runs middleware
in registration order, and every domain router is mounted **above** it — so a
`/trade…` path inside any mounted router is handled before this ever runs, and
it only fires for otherwise-unmatched paths. No trade routes exist yet
(`enable_trading` defaults off and the propose-trade flow isn't built), so
nothing is currently exposed. Move this block above the router mounts before
trading ships, or the "any path containing trade is automatically protected"
guarantee in `CLAUDE.md` will not hold.

## L-6 — Storage policies live only in the dashboard, and two contradict the code

No migration in the repo creates a single `storage.objects` policy — all of them
were made in the dashboard, contrary to the repo-as-source-of-truth rule in
`CLAUDE.md`. Two are out of step with the code that depends on them:

- **`verification-docs` has no policies at all.** `VerificationSubmissionPage.jsx`
  uploads ID photos to it from the browser and `AdminVerificationDashboard.jsx`
  calls `createSignedUrl` on it from the browser; both need policies that don't
  exist, so both are RLS-denied. The code comment asserting "the bucket's
  per-user RLS policy" describes a policy that was never created. This fails
  *closed* (no ID document is exposed), but the ID-verification flow cannot be
  working.
- **`avatars` INSERT policy is `name LIKE 'avatars/<uid>.%'`** — requiring a
  literal `.` straight after the uid. `AccountProfile.jsx` uploads
  `avatars/<uid>-<timestamp>.<ext>`, which does not match, so avatar uploads to
  that bucket are denied.

Separately, `src/api/integrated-ai.js` calls `getPublicUrl()` on `ai-images`,
which is a **private** bucket — those URLs are not retrievable, so the image
blocks handed to the model don't resolve.

Recommend bringing all storage policies into `supabase/migrations/` (the two new
migrations here start that), then reconciling these three against the code.

## L-7 — `event-scraper` insert spreads unvalidated model output

`POST /event-scraper/create-event-from-data` does
`insert({ ...req.body.eventData, status: 'pending_review' })` after checking only
that `title` is a non-empty string. Any column of `events` can be set, including
ones the flow means to control (`auto_discovered`, `id`, timestamps). Admin-only
and every row lands as `pending_review`, so impact is low — but the sibling
scanner path runs the same data through `validateAndNormalizeEventData()`, and
this route should too.

## L-8 — Turnstile fails open

`verifyTurnstileToken` returns `{ success: true, skipped: true }` when
`TURNSTILE_SECRET_KEY` is unset — intentional, so the contact form works before
the secret is provisioned. Confirm the secret is actually set in Vercel;
otherwise the contact form's only bot defence is the honeypot and the IP
limiter. (It fails *closed* on a Cloudflare outage, which is correct.)

---

## Areas reviewed and found sound

- **Payments.** `priceCart` prices every line from `shop_products`/`listings`
  server-side, blocks self-purchase, checks stock, merges duplicate lines before
  pricing. Webhook verifies signature → dedupes on `stripe_webhook_events` →
  compares Stripe's `amount_total` against the recorded order (±2¢) → claims the
  listing with a compare-and-swap before paying anyone. Wallet balance is
  debited only after payment completes, behind a reservation that survives
  concurrent checkouts. Admin refund approval recomputes from the order row, not
  the buyer-supplied refund row, and 409s on a non-pending refund.
- **RLS.** Every table in `public` has RLS on. No non-SELECT policy has an
  unscoped `USING`/`WITH CHECK`. Column-level SELECT grants keep wallet balance,
  Stripe/PayPal ids and `legal_name` out of the anon key's reach; `profiles` was
  removed from the realtime publication so those columns can't leak via
  subscription payloads. `private.can_sell()` gates listing inserts on
  `is_verified AND has_saved_card`, both pinned columns.
- **Admin authz.** `/admin` applies `authMiddleware` → `isAdminUser` →
  `requireAal2`, and privileged endpoints outside that router use the composite
  `requireAdmin`. `requireAal2` fails closed and rejects an AAL1 token whenever
  the user has a verified MFA factor — closing the "password-only token calls
  privileged API" bypass. `accept_trade` takes a `p_responder_id` argument but
  ignores it and uses `auth.uid()`.
- **Injection.** No string-concatenated SQL anywhere. `escapeLike` and
  `orFilterTerm` correctly neutralise PostgREST filter-grammar metacharacters;
  `search-suggestions` sanitises independently. No `eval`, no `new Function`, no
  `innerHTML` assignment.
- **XSS.** The one user-content HTML sink (blog articles) is DOMPurified before
  render *and* again in the Trusted Types default policy. `api/prerender.js`
  escapes every interpolation into its meta tags and `<`-escapes JSON-LD.
  Email templates escape every user-supplied field, and Resend's JSON API makes
  header injection impossible.
- **Secrets.** No live secrets in the repo. The only committed key is the
  Supabase anon key, which is public by design. `SUPABASE_SERVICE_ROLE_KEY` and
  `ENCRYPTION_KEY` are required at boot (hard throw), and the service-role client
  is never imported by frontend code.
- **Crypto.** AES-256-GCM with a random IV and authenticated decryption for MFA
  backup codes; `crypto.timingSafeEqual` for backup-code comparison, all three
  `CRON_SECRET` checks, and the Facebook `signed_request` HMAC (which also
  pins the algorithm). All cron endpoints fail closed when the secret is unset.
- **File uploads.** Multer memory storage with a size cap, a Content-Type
  pre-filter, and magic-byte validation via `file-type` that overwrites the
  claimed MIME. Storage keys use `crypto.randomBytes`, never the client filename.
- **Service worker.** Authenticated API responses go through `networkOnly` and
  are never written to Cache Storage — correctly avoiding cross-user serving on
  a shared device.
- **Proxy trust.** `trust proxy` is a bounded function (N hops plus Cloudflare's
  published ranges), so `X-Forwarded-For` can't be spoofed to defeat IP-keyed
  controls; `ipKeyGenerator` reads `req.ip` rather than the raw header.

---

## Changes in this branch

| File | Change |
|---|---|
| `src/utils/safeFetch.js` | Manual per-hop redirect following; guard re-applied to every hop; 5-hop cap; `ssrfSafeDispatcher` exported |
| `src/routes/admin.js` | `/affiliate-metadata` follows redirects manually with the allow-list + private-address check per hop, via the SSRF-safe dispatcher |
| `src/routes/search-suggestions.js` | All three `vault_items` queries scoped to `is_public` |
| `supabase/migrations/20260730201900_lock_profiles_legal_name.sql` | Pin `legal_name` against self-writes |
| `supabase/migrations/20260730202000_restrict_ai_images_bucket_access.sql` | Drop the bucket-wide `ai-images` grants; add size/MIME limits to `vault-images` |
| `tests/backend/event-scraper.test.js` | Three redirect-guard regression tests |

`npm run lint` clean; 215 test files / 2747 tests pass.

## Recommended follow-ups (not done here)

1. Decide the Trusted Types policy list (M-5) via report-only collection.
2. Bring the remaining storage policies into migrations and reconcile
   `verification-docs` and `avatars` with the code (L-6) — the ID-verification
   flow is currently broken.
3. Move the trade-route guard above the router mounts before trading ships (L-5).
4. Run `eventData` through `validateAndNormalizeEventData()` in
   `create-event-from-data` (L-7).
5. Confirm `TURNSTILE_SECRET_KEY` and `PSA_API_TOKEN` are set in Vercel.
