# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CardPop is an Australian trading card marketplace. It is a full-stack application with a React SPA frontend and an Express backend, backed by Supabase (PostgreSQL + Auth). The app is deployed on Vercel. The domain `cardpop.com.au` was purchased through Crazy Domains (registrar), but its nameservers now point to Cloudflare (`coco.ns.cloudflare.com` / `clayton.ns.cloudflare.com`) — so **Cloudflare is authoritative for DNS** and proxies traffic in front of Vercel, which hosts the app. Live DNS records (A/CNAME/MX/TXT) must be edited in the Cloudflare dashboard — not Vercel's or Hostinger's DNS editors. (Verify with `dig NS cardpop.com.au` before assuming — the nameservers have moved before: Hostinger → Vercel → Cloudflare.)

## Commands

```bash
# Development
npm run dev          # Start frontend dev server on port 3000
npm run lint         # ESLint (errors only)
npm run lint:warn    # ESLint (errors + warnings)

# Testing
npm test             # Run all tests once (frontend + backend)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report

# Run a single test file
npx vitest run tests/frontend/utils.test.js
npx vitest run tests/backend/health.test.js

# Build
npm run build        # Vite build → dist/
npm run start        # Preview the production build on port 3000
```

## Architecture

### Frontend (React SPA)

**Entry point**: `main.jsx` → `App.jsx`

All pages are lazy-loaded in `App.jsx` via React Router v7. The provider wrapping order in `App.jsx` matters: `AuthProvider` → `AdminProvider` → `CartProvider` → `CategoryHierarchyProvider`.

**Path alias**: `@/` resolves to the repository root (not `src/`). So `@/components/Header.jsx` maps to `./components/Header.jsx`.

**Pages** live in `pages/` with subdirectories for logical sections: `account/`, `admin/`, `blog/`, `collections/`, `community/`, `grading/`, `info/`, `marketplace/`, `markets/`, `shop/`, `vault/`.

**UI components** are shadcn/ui ("new-york" style, Radix UI primitives) in `components/ui/`. Add new shadcn components via the config in `components.json`. Icons are from `lucide-react`.

**Styling**: Tailwind CSS with CSS variable-based theming. Brand colors are `brand-red` and `brand-blue`. Dark mode is class-based via `next-themes`.

**Toasts**: Use `sonner` via `import { toast } from 'sonner'`.

**Forms**: `react-hook-form` + `zod` for validation.

### Authentication & Authorization

`AuthContext` (`contexts/AuthContext.jsx`) is the single source of truth for auth state. It wraps Supabase Auth and exposes `currentUser`, `session`, `profile`, `isAuthenticated`, `loading`, and `profileLoading`.

- `ProtectedRoute` — redirects to `/login` if unauthenticated; accepts `requireVerification` prop.
- `ProtectedAdminRoute` — additionally checks `currentUser.role === 'admin'`.

**Social login (OAuth)**: `components/OAuthButtons.jsx` surfaces Google / GitHub / Facebook buttons via `supabase.auth.signInWithOAuth`; a provider only works once enabled in the Supabase dashboard. On first sign-in the `on_auth_user_created` trigger (`handle_new_user()`) creates the `profiles` row — hardened in `supabase/migrations/20260712010000_harden_handle_new_user_oauth.sql` so a Facebook login with no email can't fail the `username` NOT NULL/UNIQUE constraints. Provider setup, step by step, is in `docs/oauth-login.md`.

### Data Access (Frontend)

The frontend has two data sources:

1. **Supabase** (`lib/supabaseClient.js`) — direct Supabase JS client using the public anon key. Used for all user-facing data reads/writes via Row Level Security policies. Import as `import { supabase } from '@/lib/supabaseClient.js'`.

2. **Express backend** (`lib/apiServerClient.js`) — proxied via `/hcgi/api` (Vercel rewrites this to `/api`). Used for operations requiring server-side secrets: eBay pricing, Stripe payments, card OCR, AI chat, auth/MFA flows, newsletter subscription. Always sends the Supabase `access_token` as a Bearer header automatically.

### Backend (Express → Vercel Serverless Function)

**Entry point**: `src/app.js`, exported from `api/index.js` as a Vercel serverless function.

In production the function handles all `/api/*` requests. In local dev the Express server runs on port 3001. The `vercel.json` rewrite maps `/hcgi/api/:path*` → `/api/:path*` → `api/index.js`.

Routes are registered in `src/routes/index.js`. Each domain has its own router file:

| Prefix | File | Notes |
|---|---|---|
| `/auth` | `routes/auth/index.js` | Login, MFA, password, sessions, devices |
| `/ebay` | `routes/ebay.js` | eBay price lookups (rate limited) |
| `/stripe` | `routes/stripe.js` | Checkout, payments |
| `/integrated-ai` | `routes/integrated-ai.js` | AI chat |
| `/card-ocr` | `routes/card-ocr.js` | Card image scanning |
| `/categories` | `routes/categories.js` | Category management |
| `/subcategories` | `routes/subcategories.js` | Subcategory management |
| `/vault` | `routes/vault.js` | Vault security operations |
| `/newsletter` | `routes/newsletter.js` | Kit.com newsletter subscription |

**Auth middleware** (`src/middleware/auth.js`) validates Bearer tokens by calling `supabase.auth.getUser(token)`. The backend Supabase client (`src/utils/supabaseClient.js`) uses the `SUPABASE_SERVICE_ROLE_KEY` env var for admin-level operations.

**Trade routes** are automatically protected: any request path containing `trade` passes through `authMiddleware` then `verifyTradeAccess`.

### Supabase

Supabase hosts the PostgreSQL database and provides Auth. The project URL is `https://odoglvswwymyjuwlonkf.supabase.co`.

- **Migrations**: The repo is the source of truth. Every schema change is a new `supabase/migrations/<timestamp>_<name>.sql` file — **never edit production directly in the SQL editor** (that causes drift). The repo is linked to the project via `supabase/config.toml` (`project_id`). On merge to `main`, `.github/workflows/supabase-migrations.yml` runs `supabase db push --include-all`, which applies every migration whose version isn't yet in the project's `schema_migrations` table (`--include-all` lets an unrecorded straggler apply even if its version sorts below the newest remote one). **Always create new migrations with `supabase migration new <name>`** — it stamps a full `YYYYMMDDHHMMSS` UTC timestamp, which is collision-proof. Do NOT hand-number files (`..._000001`, `..._000002`, …): two branches open at once inevitably pick the same counter, and `db push` then dies on a duplicate `schema_migrations` primary key. **Never apply SQL through the dashboard / SQL editor / Supabase assistant** — a change made there is recorded under a version that has no repo file, which blocks *every* future `db push` (`Remote migration versions not found in local migrations directory`) until the history is reconciled by hand. Let the merge apply migrations; the repo is the only path to production schema. Locally: `supabase link --project-ref odoglvswwymyjuwlonkf` once, then `supabase db push` to apply. Rules: unique version prefixes (guaranteed if you use `migration new`); write idempotent DDL (`if not exists`, `create or replace`, `drop ... if exists`); keep changes backward-compatible so the schema can land before the app that uses it. CI needs two repo secrets: `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`. (Note: `supabase db push` refuses to run while the project's `schema_migrations` table lists any *remote* version with no matching local file — the ~76 older dashboard-applied rows that pre-dated this repo were removed from tracking for exactly this reason, backed up to `supabase_migrations.schema_migrations_backup_20260703`. If that error returns after a manual dashboard change, reconcile with `supabase migration repair --status reverted <version…>` for the orphaned versions it names. Also: the whole `config.toml` must parse — an unknown key like `auth.enable_signups` fails every CLI command including `db push`.)
- **Frontend client** (`lib/supabaseClient.js`): Uses the public anon key. Security is enforced by RLS policies on the database.
- **Backend client** (`src/utils/supabaseClient.js`): Uses the service role key — bypasses RLS. Never expose this key client-side.
- **Manual backup & restore**: `scripts/backup-supabase.sh` produces a single timestamped archive (DB dump via `supabase db dump` + all Storage buckets except the sensitive `verification-docs`, via `scripts/backup-storage.mjs`) to drag into the "cardpop.com.au- site backup" Google Drive folder. Full procedure in `docs/backup-and-restore.md`. `backups/` is git-ignored — dumps hold real data/PII and must never be committed.
- **Changing region**: a project's region can't be changed in place — it's a new-project-in-`ap-southeast-2` + migrate + repoint operation with downtime. Full runbook (schema/data/auth/storage move and every hardcoded-ref repoint point) in `docs/database-region-migration.md`.

### Tests

Tests are split into two Vitest projects configured in `vitest.config.js`:

- `tests/frontend/` — runs in `happy-dom`, uses `@testing-library/react`, setup in `tests/setup.js`
- `tests/backend/` — runs in Node, uses `supertest`, setup in `tests/backend/setup.js`

### External Integrations

- **Supabase** (`lib/supabaseClient.js`, `src/utils/supabaseClient.js`): Auth and database.
- **eBay** (`src/routes/ebay.js`, `src/utils/ebayClient.js`): Market price lookups with caching (`src/utils/ebayCache.js`).
- **Stripe** (`src/routes/stripe.js`): Payment processing and checkout.
- **Kit.com** (`src/routes/newsletter.js`): Newsletter subscriptions via the Kit v4 API. Requires `KIT_API_KEY` and `KIT_FORM_ID` env vars. The `/launch` pre-launch landing page subscribes with `list: 'launch'`, which targets `KIT_LAUNCH_FORM_ID` (optional — falls back to `KIT_FORM_ID` until set). Setting `VITE_COMING_SOON=true` at build time redirects the homepage to `/launch`. Kit publishes a **Developer Docs MCP server** (`https://developers.kit.com/mcp`) that gives Claude Code read-only, always-current access to Kit's API v4 reference, OAuth flow docs, App Store guidelines and plugin architecture — handy when working on this integration. It's an optional per-developer tooling convenience and is deliberately **not** committed to the repo, so it touches nothing at runtime: the production subscribe path stays the direct v4 REST call in `src/utils/newsletter.js`. To use it, add it at user scope once — `claude mcp add --transport http --scope user kit-docs https://developers.kit.com/mcp` — then authorize it via `/mcp` in an interactive Claude Code session (it cannot be authorized in a headless/web session). (Kit also publishes a separate *operational* MCP at `https://app.kit.com/mcp` that manages the live account — forms, subscribers, broadcasts — and requires a paid Kit plan; deliberately unused here to avoid an agent mutating real subscriber data.)
- **Resend** (`src/utils/emailService.js`): **Transactional** email — the automated, server-triggered messages sent to one recipient in response to an event: order confirmed (buyer), item sold (seller), refund processed/issued, and the registration welcome offer (fired from `stripeWebhookService.js`, `refundService.js`, `welcomeOfferService.js`). Requires `RESEND_API_KEY`; sends from `noreply@cardpop.com.au`. This is a distinct role from the other two mail systems and does not overlap: **Google Workspace** is the human inbox (person-to-person mail) and **Kit.com** is bulk marketing (newsletters/campaigns). Sending requires the domain to be **verified in Resend** — its SPF/DKIM DNS records live in Cloudflare and coexist with Google's (Resend uses the `send.` subdomain + `resend._domainkey`, Google uses the root domain + `google._domainkey`). Supabase Auth emails (signup confirmation, password reset, magic links) are a separate pipeline sent by Supabase itself, not Resend. Full setup and DNS records: `docs/email.md`. If `RESEND_API_KEY` is unset the service logs a warning and silently skips sending (fail-safe).
- **Shop catalogue**: Product data, pricing, stock and checkout run entirely on Supabase (`shop_products` table) and the Stripe endpoints (`src/routes/stripe.js`). The former Hostinger/Online-Store product API (`api/EcommerceApi.js`) has been removed entirely; the `formatCurrency` helper it used to export now lives at `utils/formatCurrency.js`.

### Image serving & Supabase egress

Supabase meters ALL storage egress (including its own CDN's cache hits) against the plan quota, so image traffic is managed in three layers (see `docs/image-cdn.md`):

1. **Immutable uploads with long cache headers**: every storage upload uses a timestamped filename and `cacheControl: '31536000'`. Never reuse a storage path for changed content — upload to a new timestamped path and update the DB reference (avatars etc. already work this way). `scripts/backfill-image-cache-headers.mjs` retrofits old objects.
2. **Service worker** (`public/sw.js`): storage image URLs (`/storage/v1/object|render/image/public/`) are cached cache-first on the client (capped, oldest-first eviction), so returning visitors generate ~no image egress.
3. **CDN in front of Supabase Storage** — a Cloudflare Worker on `img.cardpop.com.au` (source: `cloudflare/image-proxy-worker.js`, deployed via the Cloudflare dashboard): when `VITE_IMAGE_CDN_HOST` is set, `utils/imageUrl.js` rewrites storage URLs onto the CDN. The same Worker also exposes a `/card-art` passthrough that caches third-party card art (Pokémon TCG / Scryfall / YGOPRODeck) into R2 so it's insulated from those upstream CDNs — activated by `CARD_ART_CDN_HOST`, see `docs/image-cdn.md`. **At render time, always build image URLs via `publicImageUrl(pathOrUrl, bucket?)` or `getCardImage()` from `utils/imageUrl.js` — don't call `supabase.storage.getPublicUrl()` directly.** Exception: URLs *stored in the DB* (e.g. `image_url` columns written by admin forms) intentionally stay canonical Supabase URLs so the CDN host can change later.
4. **Pre-generated grid thumbnails**: card image uploads also store a 480px WebP companion thumb at `<path minus ext>.thumb.webp` (`createThumbnail` / `thumbStoragePath`); `getCardImage` emits `thumbSrc` for uploads after `THUMBNAILS_SINCE` (timestamped filenames make this derivable without a DB column) and `CardImage` tries it before the full image. See `docs/image-cdn.md`.

### DDoS & abuse protection

Cloudflare (proxying all traffic) is the volumetric DDoS layer; Express rate limiters (`src/middleware/global-rate-limit.js`, `src/middleware/endpoint-rate-limit.js`) handle targeted abuse. `src/app.js` sets a `trust proxy` function that trusts Cloudflare's published edge ranges (`src/utils/cloudflareIps.js`) so `req.ip` is the real visitor, not a Cloudflare edge IP — every IP-keyed control depends on this. Dashboard-side settings (Bot Fight Mode, WAF, edge rate-limit rule, Under-Attack playbook, Supabase quota hardening) are documented in `docs/ddos-protection.md`.

### Deployment

Vercel's **native Git integration** builds and deploys on every push to `main`
(and creates preview deployments for pull requests) — no GitHub Actions step is
involved in deploying:

```
git push main
  → Vercel builds dist/ and serves api/index.js as a serverless function
```

CI on GitHub Actions is now quality-gating only: `.github/workflows/ci.yml`
(lint + tests + build) and `e2e.yml` run on pull requests, and
`.github/workflows/main-ci.yml` re-runs the same `verify` gate on pushes to
`main`. The old `deploy.yml` (which ran `vercel --prod` via the CLI using an AWS
OIDC role + SSM-stored token) was removed when deploys moved to Vercel's Git
integration; the AWS role and `/cardpop/vercel/*` SSM parameters are now unused
and can be cleaned up.

**Vercel environment variables** required in production (set in Vercel dashboard → Settings → Environment Variables):

| Variable | Used by |
|---|---|
| `SUPABASE_URL` | Backend Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend Supabase client (admin) |
| `STRIPE_SECRET_KEY` | Stripe routes |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `STRIPE_IDENTITY_FLOW_ID` | *(optional)* Stripe Identity Verification Flow (`vf_...`) for signup ID checks — falls back to an inline document+selfie config |
| `EBAY_APP_ID` | eBay API client |
| `EBAY_CLIENT_SECRET` | eBay API client |
| `PSA_API_TOKEN` | PSA certificate verification (`src/utils/psaApiClient.js`). **Unset = certs show "Verification error"** — the `/grading-verification/verify` endpoint has no non-API fallback, and the `/psa/cert` detail route only falls back to a bot-blocked, unreliable web scraper. Effectively required in production; obtain from the PSA Public API dashboard. |
| `KIT_API_KEY` | Kit.com newsletter |
| `KIT_FORM_ID` | Kit.com newsletter |
| `FACEBOOK_APP_SECRET` | Meta (Facebook) data deletion request callback (`src/routes/data-deletion.js`) — used to verify the `signed_request` HMAC-SHA256 signature. Unset = the callback rejects every request with 400. Set it to the Facebook app secret and point the App Dashboard's **Data Deletion Request URL** at `https://cardpop.com.au/hcgi/api/data-deletion/facebook` |
| `RESEND_API_KEY` | Resend transactional email (order/refund/welcome). Unset = emails silently skipped. Domain must be verified in Resend — see `docs/email.md` |
| `KIT_LAUNCH_FORM_ID` | Kit.com pre-launch notify list (`/launch` page) — optional, falls back to `KIT_FORM_ID` |
| `VITE_COMING_SOON` | Pre-launch mode (build-time): `true` redirects the homepage to `/launch` |
| `ENCRYPTION_KEY` | MFA OTP / backup code encryption |
| `VITE_AWS_LOCATION_API_KEY` | *(optional)* Amazon Location Service Places API key — address autocomplete on the checkout shipping form (build-time, public) — blank = free-text fallback |
| `VITE_AWS_LOCATION_REGION` | *(optional)* Region for the browser Amazon Location endpoint (`places.geo.<region>.amazonaws.com`) — defaults to `ap-southeast-2` |
| `AWS_LOCATION_API_KEY` | *(optional)* Amazon Location Service Places API key — server-side geocode check of the chosen shipping address before creating the Stripe session; blank = skipped (fail-open) |
| `AWS_LOCATION_REGION` | *(optional)* Region for the server-side Amazon Location endpoint — defaults to `ap-southeast-2` |
| `CORS_ORIGIN` | Express CORS (set to `https://cardpop.com.au`) |
| `APP_URL` | App base URL |
| `VITE_POKEMONTCG_API_KEY` | *(optional)* Pokémon TCG API key ([dev.pokemontcg.io](https://dev.pokemontcg.io)) for analytics card art (`utils/pokemonCardImage.js`) — blank works keyless (~1,000 req/day); a free key raises the limit to 20,000/day. Images are served from the API's own CDN, so they cost nothing against Supabase egress |
| `VITE_CF_BEACON_TOKEN` | *(optional, build-time)* Cloudflare Web Analytics site token — `main.jsx` loads the RUM beacon itself so it passes the `strict-dynamic` CSP. **Keep the Cloudflare dashboard's "automatic setup" (edge auto-injection) switched OFF** — the injected snippet has no nonce/hash and is blocked by the CSP, producing console errors. Blank = beacon not loaded |
| `VITE_SUPABASE_IMAGE_TRANSFORMS` | *(optional, build-time)* `true` enables Supabase Storage image transformations (responsive `srcSet` resizing via `/render/image`) in `utils/imageUrl.js`. **Default off** — the render endpoint 403s unless transformations are enabled on the Supabase plan (Dashboard → Storage → Settings), and leaving it on spams the logs with 403s on every page load. Enable the plan feature first, then set this to `true`. See `docs/image-cdn.md` |
| `VITE_IMAGE_CDN_HOST` | *(optional)* Image CDN host (e.g. CloudFront) — frontend image URLs |
| `IMAGE_CDN_HOST` | *(optional)* Same host, for `api/prerender.js` og:image URLs |
| `CARD_ART_CDN_HOST` | *(optional)* Card-art CDN host — when set, the server-side card-art resolver (`src/utils/cardImageResolver.js`) serves resolved Pokémon/Magic/Yu-Gi-Oh art through the Worker's `/card-art` route (cached in R2, insulated from the upstream APIs' CDNs) instead of hotlinking them. Off by default; **only set after the Worker with the `/card-art` route is deployed** — see `docs/image-cdn.md` → "Card-art passthrough" |

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public and already hardcoded in `lib/supabaseClient.js` — no need to add them as Vercel secrets.
