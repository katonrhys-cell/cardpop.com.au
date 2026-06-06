# CardPop — Product Requirements Document

## Overview

CardPop is an Australian trading card marketplace connecting collectors, traders, and investors. It combines a peer-to-peer marketplace, a first-party shop, a digital card vault, and market analytics tools into one platform — built specifically for the Australian market.

**URL**: cardpop.online  
**Target market**: Australia  
**Primary audience**: Trading card collectors, traders, and investors (Pokémon, sports cards, MTG, etc.)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 SPA, Vite, React Router v7 |
| UI | shadcn/ui (Radix primitives), Tailwind CSS, lucide-react |
| Backend | Express.js → Vercel Serverless Function (`api/index.js`) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (email/password, MFA, magic link) |
| Deployment | Vercel (auto-deploy from `main` via GitHub Actions) |
| Domain | cardpop.online — DNS via Hostinger, resolves to Vercel |
| Payments | Stripe |
| Email marketing | Kit.com (ConvertKit) |
| Market data | eBay AU API |
| Monitoring | Datadog Synthetics |

---

## User Roles

| Role | Description |
|---|---|
| **Guest** | Can browse listings, shop, view market data and public profiles without an account |
| **Member** | Registered, email-verified user — can buy, sell, trade, manage a vault and wallet |
| **Seller** | Member with an active seller profile — additional dashboard and listing tools |
| **Admin** | Full platform access including user management, content, orders, and analytics |

---

## Core Feature Areas

### 1. Authentication

- Email + password signup with password strength enforcement
- Email verification required before full access
- Profile completion flow after email verification
- Password reset via email
- Multi-factor authentication (TOTP)
- Backup codes
- Trusted device management
- Active session listing and revocation
- Login history / audit log
- Newsletter opt-in at signup (Kit.com)

### 2. Marketplace (Peer-to-Peer)

- Listings browsable by category, set, condition, price
- Full-text and filtered search (`/search`)
- Individual card listing detail pages with photos
- Make an offer / accept / decline flow
- Trade requests between members
- Seller reviews and ratings
- Public seller profile pages
- Listing management dashboard for sellers

### 3. Shop (First-Party)

- Sealed boxes, booster packs, and singles sold by CardPop directly
- Product catalogue via Hostinger Ecommerce API
- Product detail pages with variants
- Cart with quantity management
- Stripe checkout and payment confirmation
- Order history

### 4. Digital Vault

- Members can store their card collection digitally
- Card scanning via OCR (`/card-ocr`) to auto-populate details
- Manual card entry
- Public vault profile pages
- Vault category browsing
- Vault listings (list vault cards for sale directly)

### 5. Market Analytics

- Live and historical eBay AU price data per card
- Card detail pages with price charts
- Australian market overview page
- Market category pages (by game/set)
- Insider trading / trends page
- Card analytics page per card

### 6. Community

- Community discussions
- Community events listing and detail pages
- Whatnot shows integration
- Community user profiles

### 7. Grading Hub

- Guide to PSA, BGS, SGC and other grading companies
- Grading scale reference
- What is grading? explainer
- Grading submission guide

### 8. Blog / Content

- Blog articles with category pages
- Admin article management

### 9. Account Dashboard

| Section | Path | Description |
|---|---|---|
| Dashboard | `/account` | Overview of activity |
| Profile | `/account/profile` | Edit display name, bio, avatar |
| Listings | `/account/listings` | Active and sold listings |
| Offers | `/account/offers` | Incoming and outgoing offers |
| Watchlist | `/account/watchlist` | Saved listings |
| Wallet | `/account/wallet` | CardPop balance, top-up, withdraw |
| Transactions | `/account/transactions` | Full transaction history |
| Reviews | `/account/reviews` | Reviews given and received |
| Vault | `/account/vault` | Digital card vault management |
| Security | `/account/security` | MFA, devices, session management |
| Notifications | `/account/notifications` | Notification preferences |

### 10. Admin Panel

| Section | Description |
|---|---|
| Dashboard | Platform KPIs and activity summary |
| User management | Search, view, suspend users |
| User detail | Per-user activity, roles, verification |
| Marketplace management | Moderate listings |
| Order management | Review and action orders |
| Product management | First-party shop products |
| Category management | Category and subcategory tree |
| Collections management | Featured collections |
| Brands management | Card brands/publishers |
| Product lines | Product line catalogue |
| Content management | Static content pages |
| Article management | Blog articles |
| Media library | Uploaded assets |
| Events management | Community events |
| Analytics | Platform usage reports |
| Verification dashboard | Member verification queue |
| System diagnostics | Health checks and config |
| Settings | Platform-wide configuration |

---

## Data Model (Supabase)

Core tables in PostgreSQL via Supabase:

- `profiles` — user profile data (display name, bio, avatar, verified status)
- `listings` — marketplace card listings
- `offers` — buyer offers on listings
- `trades` — trade requests between members
- `orders` — shop orders
- `order_items` — line items per order
- `transactions` — wallet debits and credits
- `reviews` — seller reviews
- `vault_cards` — digital vault card entries
- `watchlist` — saved listing records
- `notifications` — user notification feed
- `events` — community events
- `articles` — blog posts
- `categories` / `subcategories` — product taxonomy

Auth is handled entirely by Supabase Auth (`auth.users`). All tables reference `auth.users.id` and are protected by Row Level Security policies.

---

## External Integrations

### Supabase
- Auth: email/password, magic link, MFA
- Database: PostgreSQL with RLS
- Storage: user avatars and card images

### Stripe
- Checkout sessions for shop purchases
- Webhook to confirm payment and create orders
- Customer portal for payment method management

### eBay AU API
- Browse API: search sold/active listings for a card name
- Used for price data on card and market pages
- Responses cached in-memory with a configurable TTL

### Kit.com (ConvertKit)
- Newsletter subscription via Kit v4 API
- Subscribed at signup (opt-in checkbox) and via footer form
- Backend proxy at `POST /api/newsletter/subscribe` keeps API key server-side

### Hostinger Ecommerce API
- Product catalogue for the first-party shop
- Provides sealed boxes, singles, and variants
- Separate from domain/DNS — CardPop has a store configured on `api-ecommerce.hostinger.com`

### Datadog
- Synthetic browser tests run on push to `main`
- Monitors critical user journeys in production

---

## Deployment

```
Developer pushes to main
  → GitHub Actions: npm install → vercel --prod
  → Vercel builds Vite SPA → dist/
  → Vercel deploys api/index.js as a serverless function (max 30s)
  → Vercel serves dist/ as static files
  → /hcgi/api/* and /api/* route to the serverless function
  → /* falls back to index.html (SPA routing)
```

DNS: `cardpop.online` A/CNAME records in Hostinger point to Vercel's edge network.

---

## Security

- Supabase RLS enforces data access at the database layer
- Express backend validates all tokens via `supabase.auth.getUser()`
- Helmet.js sets security headers (HSTS, CSP, X-Frame-Options, etc.)
- CSRF middleware on all mutating backend requests
- Global and per-endpoint rate limiting
- MFA available for all accounts
- Session timeout middleware
- Stripe webhook signature verification

---

## Environment Variables (Vercel)

Set these in Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Backend admin key — never expose client-side |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | For webhook signature verification |
| `EBAY_APP_ID` | Yes | eBay developer app ID |
| `EBAY_CLIENT_SECRET` | Yes | eBay developer secret |
| `KIT_API_KEY` | Yes | Kit.com API secret key |
| `KIT_FORM_ID` | Yes | Kit.com form ID for newsletter signups |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for MFA/backup code encryption |
| `CORS_ORIGIN` | Yes | `https://cardpop.online` |
| `APP_URL` | Yes | `https://cardpop.online` |

The Supabase public anon key and project URL are safe to hardcode in `lib/supabaseClient.js` — they are not secrets.
