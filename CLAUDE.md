# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CardPop is an Australian trading card marketplace. It is a full-stack application with a React SPA frontend and an Express backend, both backed by a self-hosted PocketBase instance.

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
npm run build        # Generates llms.txt then Vite build → dist/
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

`AuthContext` (`contexts/AuthContext.jsx`) is the single source of truth for auth state. It exposes `currentUser`, `isAuthenticated`, `isEmailVerified`, `isAdmin`, and `loading`.

- `ProtectedRoute` — redirects to `/login` if unauthenticated; accepts `requireVerification` prop.
- `ProtectedAdminRoute` — additionally checks `currentUser.role === 'admin'`.

### Data Access (Frontend)

The frontend has two data sources:

1. **PocketBase** (`lib/pocketbaseClient.js`) — proxied via `/hcgi/platform`. Used for all user-facing collections: `trading_cards`, `cards`, `officialCatalog`, `users`, `featuredSellers`, `marketplaceStructure`, `auditLogs`, etc.

2. **Express backend** (`lib/apiServerClient.js`) — proxied via `/hcgi/api`. Used for operations requiring server-side secrets: eBay pricing, Stripe payments, card OCR, AI chat, auth/MFA flows.

Pages import `pb` from `@/lib/pocketbaseClient.js` directly for simple reads. Sensitive or complex operations go through `apiServerClient`.

### Backend (Express)

**Entry point**: `src/main.js` → `src/app.js`, runs on port 3001.

Routes are registered in `src/routes/index.js`. Each domain has its own router file:

| Prefix | File | Notes |
|---|---|---|
| `/auth` | `routes/auth/index.js` | login, MFA, password, sessions, devices |
| `/ebay` | `routes/ebay.js` | eBay price lookups (rate limited) |
| `/stripe` | `routes/stripe.js` | Checkout, payments |
| `/integrated-ai` | `routes/integrated-ai.js` | AI chat |
| `/card-ocr` | `routes/card-ocr.js` | Card image scanning |
| `/categories` | `routes/categories.js` | Category management |
| `/vault` | `routes/vault.js` | Vault security operations |

**Auth middleware** (`src/middleware/auth.js`) validates Bearer tokens by calling PocketBase directly at `localhost:8090`. The backend's PocketBase client (`src/utils/pocketbaseClient.js`) auto-authenticates as superuser using `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD` env vars.

**Trade routes** are automatically protected: any request path containing `trade` passes through `authMiddleware` then `verifyTradeAccess`.

### PocketBase

PocketBase runs locally at `http://localhost:8090`. Download it using `./setup.sh` (reads version from `.pocketbase-version`).

- **Migrations** (`pb_migrations/`): JavaScript files applied at PocketBase startup.
- **Hooks** (`pb_hooks/`): Server-side JavaScript that runs on PocketBase events (email sending, audit logging, balance updates, role assignment, etc.).

### Tests

Tests are split into two Vitest projects configured in `vitest.config.js`:

- `tests/frontend/` — runs in `happy-dom`, uses `@testing-library/react`, setup in `tests/setup.js`
- `tests/backend/` — runs in Node, uses `supertest`, setup in `tests/backend/setup.js`

### External Integrations

- **Hostinger Ecommerce** (`api/EcommerceApi.js`): Shop products, variants, cart — connects to `https://api-ecommerce.hostinger.com`.
- **eBay** (`src/routes/ebay.js`, `src/utils/ebayClient.js`): Market price lookups with caching (`src/utils/ebayCache.js`).
- **Stripe** (`src/routes/stripe.js`): Payment processing.
- **Datadog**: Synthetic test monitoring on push to `main`.

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys to Hostinger via FTP on push to `main`. The built frontend goes to `/public_html/`.
