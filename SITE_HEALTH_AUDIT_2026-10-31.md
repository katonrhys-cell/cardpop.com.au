# Site Health Audit — 2026-10-31

A full-site bug examination of cardpop.com.au: the repository's own quality
gates, production telemetry (Vercel runtime errors, Supabase edge/Postgres
logs, the Supabase security and performance advisors, the scheduled-job state
tables), the GitHub Actions history, Vercel environment configuration and
`npm audit`. The live site could not be fetched directly from the audit
sandbox (network policy), so page-level checks rely on telemetry rather than
a crawl.

## Verdict

The application code is healthy: lint clean, 4,848 tests passing, production
build succeeds, every repo migration is applied to the database, no stuck
payments, no expired offers awaiting a sweep. The problems are operational:
**every scheduled job had been failing since 13 September** (the GitHub
Actions cron runners were sending a `CRON_SECRET` that no longer matched
Vercel's), the PSA certificate API key is rejected, and one latent database
bug would have broken every new listing the moment the admin "listing
approval" switch was turned on. The code fixes are in this PR; the rest needs
dashboard or secret changes listed under **Needs your action**.

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm test` | 400 files, 4,848 passed, 4 skipped |
| `npm run build` | succeeds |
| Supabase migrations | in sync — latest `20261031015048` is in `schema_migrations` |
| Orders `pending` > 2 h (missed webhook) | 0 |
| Offers past expiry still `pending` | 0 |
| Events awaiting review | 0 |
| Vercel runtime errors, last 7 days | 18 groups, all explained below |
| `npm audit --omit=dev` | 9 vulnerabilities (1 critical, 6 high, 2 moderate) — see D |

## Fixed in this PR

### 1. `listing_status` enum has no `pending` value (latent, would block all new listings)

`enforce_listing_approval()` sets `status := 'pending'` whenever the admin
setting `listing_approval_required` is on, and the app, Admin → Listings and
`vaultListingService.js` all handle that state. Production's enum, created
before this repository existed, is
`('draft','active','sold','ended','archived','removed')` and no migration ever
added `pending`. Only the DB test stub (`tests/db/listing_approval_stub_schema.sql`)
declared it, which is why the test passed while production would fail with
`invalid input value for enum listing_status: "pending"` on every insert.

The switch is off today, so nothing is broken yet.

- `supabase/migrations/20261031134827_listing_status_pending_value.sql` adds
  the value (`add value if not exists`).
- The DB test stub now mirrors production's enum and the runner applies the
  new migration first; `tests/db/run-listing-approval-migrations.sh` passes
  against a throwaway Postgres 16 with that change.

### 2. Supabase errors logged as `[object Object]`

`src/utils/logger.js` only serialised `Error` instances; Supabase/PostgREST
errors are plain objects, so the seven `[VAULT] Marketplace listing sync
failed … "[object Object]"` lines from 25 October carried no cause. (The cause,
found by querying the DB: a Hobby-tier seller uploaded 7 cards in one sitting,
the first 5 listed, the next 6 attempts were refused by the 5-per-month quota
trigger — working as designed, and the UI reports it as `quota`.) The logger
now copies `message`, `code`, `details`, `hint` and `status` from plain-object
errors, falls back to JSON, and never throws. Covered by
`tests/backend/logger.test.js`.

### 3. AI proxy calls to `undefined/generate`

`INTEGRATED_AI_API_URL` has never been set in production. `stream()` /
`streamOneShot()` in `src/api/integrated-ai.js` built `undefined/generate`
and surfaced as `TypeError: Failed to parse URL from undefined/generate`
(twice in 7 days, from the admin Event Scraper panel). Both functions now
refuse up front with a 503-shaped `IntegratedAiNotConfiguredError` naming the
variable; `POST /integrated-ai/stream` answers 503 with that message and the
event-scraper SSE error carries it. Covered by
`tests/backend/integratedAiConfigured.test.js` and a new case in
`tests/backend/integrated-ai.test.js`. See E below for what to do about the
scraper itself.

### 4. Supabase advisor clean-up

`supabase/migrations/20261031134900_advisor_cleanup_initplan_search_path_trigger_grants.sql`:

- **13 RLS policies** added since the July sweep call `auth.uid()` bare (once
  per row). Rewritten from their live definitions to `(select auth.uid())`;
  the rewrite was dry-run against production's policy text and round-trips
  exactly.
- **4 trigger functions** without a pinned `search_path`
  (`set_updated_at`, `event_reviews_touch_updated_at`,
  `players_sync_born_year`, `giveaways_touch_updated_at`) get
  `set search_path = public`.
- **Every trigger function** loses its default `EXECUTE` grant to
  `public`/`anon`/`authenticated`. A function that `RETURNS trigger` can't be
  called via RPC or SQL and firing a trigger doesn't check the invoker's
  EXECUTE (the listings triggers have had this revoked since July and
  listings are still written by ordinary users), so this is zero-risk and
  removes ~30 lint findings so a real one can be seen. Verified on a scratch
  DB: applied twice without error, a revoked trigger still fires for the
  `authenticated` role.

## Needs your action

### A. The scheduled jobs were dead for seven weeks — verify tonight's Worker runs

Every run of `Cron · Blog article generation` from **13 September to 31
October (48 runs)** failed with `HTTP 401 {"error":"Unauthorized"}`: the
GitHub Actions `CRON_SECRET` no longer matched Vercel's. The sibling cron
workflows used the same secret. Consequences visible in the DB:

| Job | Last successful evidence |
|---|---|
| Blog generation | last article 5 Aug; **12 topics queued since 18 Oct, 0 attempts** |
| Weekly event scan | last run 18 Oct (the 25 Oct run never happened) |
| GA4 / Search Console sync | never run (`site_traffic_summary` is empty; its env vars were added today at 10:54 UTC, so this one is expected) |
| Supplier price watch | no rows in `shop_supplier_price_history` |

Today's work (#1094) moved every schedule to the Cloudflare Worker and
rotated `CRON_SECRET` in Vercel (10:36 UTC). The Cloudflare connector isn't
authorised in this session, so I could not confirm the Worker is deployed or
that its secret matches. Check after the first firings:

- 14:15 UTC and every 2 h: `Reconcile pending payments`
- 19:23 UTC: `Daily maintenance` → `site_traffic_summary` should gain a row
- 21:07 UTC: `Blog article generation` → a `blog_article_topics` row should
  move to `attempts = 1`, and a draft should appear in `blog_articles`
- Sunday 17:07 UTC: `Event scan`

Worker → Logs shows one JSON report per run; with `RESEND_API_KEY` set as a
Worker secret a failure emails admin@cardpop.com.au. If nothing fires, run
`npx wrangler deploy --config cloudflare/scheduler/wrangler.toml` and
`npx wrangler secret put CRON_SECRET --config cloudflare/scheduler/wrangler.toml`
with the value now in Vercel (`docs/scheduled-jobs.md`).

### B. PSA certificate verification is failing

`PSA_API_TOKEN` (set 8 July) is answered `403 Forbidden` by the PSA Public
API on every lookup (recurring in the 7-day error log, most recently today
06:31 UTC). Every "Verify PSA cert" on the site shows "Verification error"
until the token is regenerated in the PSA Public API dashboard and updated in
Vercel.

### C. Enable leaked-password protection in Supabase Auth

Supabase Dashboard → Authentication → Settings → "Leaked password
protection" is off (advisor warning). One toggle; no code change.

### D. Merge the open Dependabot PRs

`npm audit --omit=dev` reports: dompurify **critical**; body-parser, multer,
sharp, undici, zod **high**; ip-address, qs moderate. Open PRs #1109
(dompurify), #1111 (body-parser), #1107 (multer), #1105 (sharp) and #1101
(undici) have green CI and clear five of the eight. `zod` comes in through
`@imgly/background-removal >= 1.2.0` and only `npm audit fix --force` (a
downgrade to 1.1.5) clears it today — wait for upstream rather than downgrade.
`ip-address` and `qs` are transitive and moderate.

### E. Decide the Event Scraper's future (`INTEGRATED_AI_API_URL`)

The admin panel's "Scrape event URL" / "Extract from content" buttons
(Admin → Events, `components/EventScraperPanel.jsx`) still go through the
Hostinger-era AI proxy, which has no URL in this deployment, so they have
never worked here (now they say so instead of a bare 500). The nightly event
scanner and the grade estimator already call the Anthropic API directly; the
scraper should be ported the same way (`src/utils/gradeEstimator.js` is the
template). Nothing else uses the proxy — the AI chat component is not mounted
anywhere.

### F. Smaller configuration gaps (optional features)

- `FACEBOOK_APP_SECRET` is unset, so the Meta data-deletion callback
  (`/hcgi/api/data-deletion/facebook`) rejects every request with 400. Only
  matters if Facebook login is enabled in Supabase.
- `VAPID_*` unset → web push stays hidden (fail-safe, by design).
- `VITE_IMAGE_TRANSFORMS` exists in Vercel but the code reads
  `VITE_SUPABASE_IMAGE_TRANSFORMS`; harmless (transforms default off, which is
  the documented safe setting) — delete the stray variable.

### G. Remaining Supabase advisor findings (not changed here)

- **176 `multiple_permissive_policies` warnings** across 35 tables (events
  alone has 15 overlapping policies): each permissive policy is evaluated per
  row per query. The fix is the same consolidation pattern as
  `20260719113047_consolidate_multiple_permissive_policies.sql`, table by
  table, with the DB tests extended — a separate PR.
- **31 non-trigger `SECURITY DEFINER` functions callable by `anon`.** The
  money/role ones were reviewed and all verify `auth.uid()` inside
  (`accept_trade`, `admin_set_complimentary_membership`,
  `admin_set_featured_seller`, `seller_sales`, `seller_sale_shipping`).
  `increment_post_views` and `record_event_ticket_click` let an anonymous
  caller inflate a vanity counter; `get_user_event_rsvps(profile_id)` lets
  anyone read which approved events a given user RSVP'd to — decide whether
  that's intended.
- **20 unindexed foreign keys**, mostly `created_by` / `moderated_by` admin
  columns on small tables — low value, and the project already carries 188
  unused indexes, so don't add these blindly.
- **7 tables with RLS on and no policy** (`api_cache`, `rate_limit_counters`,
  `push_subscriptions`, …) — service-role-only tables; correct as is.

## Resolved before this audit (seen in the logs, fixed by today's deploys)

- **15 × HTTP 400** for `/storage/v1/object/public/vault-images/images/stores/cleet-collectables.png`
  (a bundled store logo being treated as a storage path), last at 02:12 UTC.
  Fixed by #1093, deployed 10:40 UTC; `tests/frontend/imageUrl.test.js` pins it.
- **6 × `column site_traffic_summary.search_impressions_30d does not exist`**
  at 02:01 UTC. The frontend that selects the new columns deployed before
  `supabase db push` could run (the Actions minutes were exhausted, which is
  what #1094/#1100/#1110 fixed). Applied now. Note `lib/homepageData.js` has
  no fallback for missing columns, so a future column must land in the
  database before the frontend selects it.

## Noise in the error view

- `DEP0169 url.parse() DeprecationWarning` — 874 occurrences in 7 days on
  `/api/prerender` and `/api/event-scan`, from a dependency, harmless. It
  dominates the Vercel error list; silence it with `NODE_OPTIONS=--no-deprecation`
  on those functions or upgrade the dependency when identified.
- 3 eBay timeouts, 2 grade-estimator timeouts, 1 CardSight rate-limit — transient.
- 3 × `/auth/v1/signup` 422 in 24 h — normal (existing email / weak password).

## Method

- Repo: `npm run lint`, `npm test`, `npm run build`, `npm audit --omit=dev`.
- Vercel: project `card-pop-online`, runtime error clusters (7 d), production
  deployments, environment variable names (values never read).
- Supabase: security + performance advisors; edge logs (status ≥ 400) and
  Postgres error logs for 24 h; `schema_migrations`; job-state tables
  (`site_traffic_summary`, `event_scan_runs`, `blog_article_topics`,
  `blog_articles`, `orders`, `offers`, `events`, `shop_supplier_price_history`);
  the live definitions of every policy and function touched by the migration.
- GitHub: open PRs, Actions run history, and the failed-job log of the latest
  blog cron run.
