# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CardPop is an Australian trading card marketplace. It is a full-stack application with a React SPA frontend and an Express backend, backed by Supabase (PostgreSQL + Auth). The app is deployed on Vercel. The domain `cardpop.com.au` was purchased through Crazy Domains (registrar), with DNS managed through Hostinger (DNS only — no Hostinger web hosting or FTP involved; the app itself is hosted on Vercel).

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

- **Migrations**: The repo is the source of truth. Every schema change is a new `supabase/migrations/<timestamp>_<name>.sql` file — **never edit production directly in the SQL editor** (that causes drift). The repo is linked to the project via `supabase/config.toml` (`project_id`). On merge to `main`, `.github/workflows/supabase-migrations.yml` runs `supabase db push`, which applies only the migrations whose version isn't yet in the project's `schema_migrations` table. Locally: `supabase link --project-ref odoglvswwymyjuwlonkf` once, then `supabase db push` to apply, or `supabase migration new <name>` to scaffold. Rules: unique, monotonically increasing version prefixes (no duplicates); write idempotent DDL (`if not exists`, `create or replace`, `drop ... if exists`); keep changes backward-compatible so the schema can land before the app that uses it. CI needs two repo secrets: `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`. (Note: the project's `schema_migrations` also contains ~55 older dashboard-applied rows with no repo file — pre-dating this workflow; harmless, `db push` ignores them.)
- **Frontend client** (`lib/supabaseClient.js`): Uses the public anon key. Security is enforced by RLS policies on the database.
- **Backend client** (`src/utils/supabaseClient.js`): Uses the service role key — bypasses RLS. Never expose this key client-side.

### Tests

Tests are split into two Vitest projects configured in `vitest.config.js`:

- `tests/frontend/` — runs in `happy-dom`, uses `@testing-library/react`, setup in `tests/setup.js`
- `tests/backend/` — runs in Node, uses `supertest`, setup in `tests/backend/setup.js`

### External Integrations

- **Supabase** (`lib/supabaseClient.js`, `src/utils/supabaseClient.js`): Auth and database.
- **eBay** (`src/routes/ebay.js`, `src/utils/ebayClient.js`): Market price lookups with caching (`src/utils/ebayCache.js`).
- **Stripe** (`src/routes/stripe.js`): Payment processing and checkout.
- **Kit.com** (`src/routes/newsletter.js`): Newsletter subscriptions via the Kit v4 API. Requires `KIT_API_KEY` and `KIT_FORM_ID` env vars.
- **Shop catalogue**: Product data, pricing, stock and checkout run entirely on Supabase (`shop_products` table) and the Stripe endpoints (`src/routes/stripe.js`). The former Hostinger/Online-Store product API has been removed; `api/EcommerceApi.js` now only exports a `formatCurrency` helper and makes no external calls.

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) deploys to Vercel on every push to `main`:

```
git push main
  → GitHub Actions: npm install → vercel --prod
  → Vercel builds dist/ and serves api/index.js as a serverless function
```

**Vercel environment variables** required in production (set in Vercel dashboard → Settings → Environment Variables):

| Variable | Used by |
|---|---|
| `SUPABASE_URL` | Backend Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend Supabase client (admin) |
| `STRIPE_SECRET_KEY` | Stripe routes |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `EBAY_APP_ID` | eBay API client |
| `EBAY_CLIENT_SECRET` | eBay API client |
| `KIT_API_KEY` | Kit.com newsletter |
| `KIT_FORM_ID` | Kit.com newsletter |
| `ENCRYPTION_KEY` | MFA OTP / backup code encryption |
| `CORS_ORIGIN` | Express CORS (set to `https://cardpop.com.au`) |
| `APP_URL` | App base URL |

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public and already hardcoded in `lib/supabaseClient.js` — no need to add them as Vercel secrets.
