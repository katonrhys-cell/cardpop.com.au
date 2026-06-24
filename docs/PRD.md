# CardPop Australia — Product Requirements Document
**Version 1.1 · June 2026 · Confidential**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Brand Foundation](#2-brand-foundation)
3. [Current Platform Audit](#3-current-platform-audit)
4. [Strategic Vision & Goals](#4-strategic-vision--goals)
5. [Platform Architecture Blueprint](#5-platform-architecture-blueprint)
6. [Feature Roadmap](#6-feature-roadmap)
7. [Live Auction Platform — Detailed Requirements](#7-live-auction-platform--detailed-requirements)
8. [Trust & Safety Framework](#8-trust--safety-framework)
9. [Technical Architecture](#9-technical-architecture)
10. [Data Model](#10-data-model)
11. [Design System Standards](#11-design-system-standards)
12. [Compliance & Legal](#12-compliance--legal)
13. [Success Metrics](#13-success-metrics)
14. [Open Questions & Decisions](#14-open-questions--decisions)

---

## 1. Executive Summary

**CardPop Australia** is Australia's trusted digital card show — a community-first marketplace for collectible trading cards (TCG, sports, graded slabs) that brings the energy and trust of a physical card convention into a permanent, accessible online platform.

The platform is a mature, 133-page application with a complete marketplace, trading, vault, community, grading, AI, and admin surface. The primary upcoming milestone is a **Live Auction System** — enabling verified users to run real-time auctions. Phase 3 will add CardPop-curated platform auctions.

This document is the canonical source of truth for what CardPop is, what it is being built into, and the structural decisions that should not be re-litigated at implementation time.

---

## 2. Brand Foundation

> All product decisions must be evaluated against brand fit before implementation.

### 2.1 Mission & Vision

| | Statement |
|---|---|
| **Mission** | Create Australia's most trusted and engaging digital card show where collectors can connect, trade, explore, and grow their collections confidently. |
| **Vision** | Become the leading global ecosystem for collectible card enthusiasts by combining community, trust, marketplace functionality, and hobby culture. |
| **Positioning** | A trusted, modern, community-first marketplace inspired by collector culture, convention energy, and the accessibility of modern digital platforms. |

### 2.2 Brand Archetypes

- **Sage** — Information, trust, expertise. Grading guides, market data, collector education.
- **Everyman** — Accessibility and community. Every collector belongs, from first card to full slab collection.
- **Explorer** — Discovery, the thrill of the find, the energy of a show — brought online.

### 2.3 Voice & Messaging Pillars

`Trust` · `Community` · `Discovery` · `Accessibility` · `Simplicity` · `Passion`

### 2.4 Brand Personality

Trusted · Modern · Passionate · Knowledgeable · Energetic · Collector-Focused · Accessible · Friendly · Efficient

### 2.5 Taglines

- Primary: **"Explore. Trade. Collect."**
- Alternative: "Where Collectors Connect"
- Alternative: "Australia's digital card show"

### 2.6 Colour Palette

| Token | Hex | Usage |
|---|---|---|
| CardPop Red | `#CE1126` | Primary CTAs, accents, collector energy (10–15% of any layout) |
| Marketplace Charcoal | `#1F2937` | Typography, navigation, dark hero panels |
| Soft Silver | `#C4CED4` | Secondary surfaces, dividers |
| Light Grey | `#F5F7FA` | Page backgrounds, card fills |
| Cloud White | `#FFFFFF` | UI cards, modal backgrounds |
| CTA Hover Red | `#A50E1F` | Button hover (darken 10%) |

### 2.7 Typography

| Style | Font | Size | Usage |
|---|---|---|---|
| Display XL | Syne ExtraBold 800 | 52–64px | Hero headlines, show titles |
| Display LG | Syne ExtraBold 800 | 36–48px | Section heroes, feature headings |
| Heading 1 | Syne Bold 700 | 28–32px | Page titles, seller profiles |
| Heading 2 | Syne Bold 700 | 20–24px | Section headings, card titles |
| Body LG | Helvetica Neue 400 | 16–18px | Primary body text |
| Body SM | Helvetica Neue 400 | 13–14px | Secondary info, card metadata |
| Label | Helvetica Neue 500 | 10–12px | Tags, badges, UI labels |
| Micro | Helvetica Neue 400 | 9–10px | Legal, footnotes, timestamps |

### 2.8 Border Radius System

`6px` buttons · `8px` inputs · `12px` cards · `999px` pills

### 2.9 Trust & Community Signals (per Brand Guide)

Every listing and auction card must display:

| Signal | Detail |
|---|---|
| Seller verification badge | ID-checked, tier-based: Verified / PowerSeller / Elite |
| Star rating | 5-star in CardPop Red; requires ≥ 3 reviews before aggregate |
| Sales count badge | "X sales" visible on all seller surfaces |
| Member tenure | Join date on profile |
| Secure Trade Indicator | Lock icon + "Protected Trade" label on eligible transactions |

### 2.10 Imagery Direction

**Use:** Graded slabs on clean surfaces, convention energy, tabletop card layouts, real collector portraits, authentic community moments.

**Avoid:** Generic stock photography, gambling/casino aesthetics, crypto/NFT visual clichés, over-filtered imagery.

---

## 3. Current Platform Audit

### 3.1 Scale & Scope

CardPop is a large, mature application. As of June 2026:

- **133 frontend pages** across 12 top-level sections
- **38+ database collections** (Supabase + PocketBase)
- **18 PocketBase hooks** for email and system automation
- **Full auth surface**: email verification, MFA, device trust, session management
- **6 backend route domains**: auth, eBay, Stripe, AI, card-OCR, categories, vault, event scraper

### 3.2 Feature Inventory

| Feature Area | Status | Notes |
|---|---|---|
| Auth & MFA | ✅ Complete | Supabase Auth + MFA + devices + sessions |
| Email verification | ✅ Complete → migrate | PocketBase hooks → Supabase Edge Functions |
| Seller verification flow | ✅ Complete | AdminVerificationDashboard + VerificationSubmissionPage |
| Marketplace browse | ✅ Complete | Filters, search, categories, featured sellers |
| Fixed-price listings | ✅ Complete | Full buy-now flow via Stripe |
| Card vault | ✅ Complete | Private/For Sale/For Trade/Both listing types |
| Trade system | ✅ Complete | Offer, accept/decline, messaging, email notifications |
| Collections | ✅ Complete | User-created, public/private |
| Shop (sealed) | ✅ Complete | Hostinger Ecommerce integration |
| eBay price lookups | ✅ Complete | Rate-limited, cached |
| Market analytics | ✅ Complete | Price history, trends, insider trading signals |
| Grading guides | ✅ Complete | PSA/BGS/CGC/SGC education content |
| Blog & content | ✅ Complete | Articles, categories, admin CMS |
| Community & events | ✅ Complete | Forums, events, Whatnot show tracking |
| AI chat | ✅ Complete | Integrated AI assistant (Express backend) |
| Card OCR | ✅ Complete | Image-to-card-identification |
| Watchlist | ✅ Complete | Saves with auction countdown display |
| Seller profiles | ✅ Complete | Public profiles, ratings, sales history |
| Admin panel | ✅ Complete | 21+ admin pages covering all domains |
| Audit logging | ✅ Complete | PocketBase hooks + auditLogs collection |
| Messaging | ✅ Complete | Private user-to-user messages |
| Auction data model (partial) | 🔄 Partial | `auction_end_at`, `listing_type: "auction"` field exists; bid flow not built |
| Live auction bidding | ❌ Not built | Primary next feature |
| Anti-snipe logic | ❌ Not built | Required for auctions |
| Auction creation flow | ❌ Not built | Required for auctions |
| Real-time bid feed | ❌ Not built | Supabase Realtime channels ready |
| In-app notification centre | ❌ Not built | Needed for auction events |
| Escrow / buyer protection | ❌ Future | Phase 3 |
| Platform-run auctions | ❌ Future | Phase 3 |
| PowerSeller / Elite tiers | ❌ Planned | Phase 2–3 |

### 3.3 Existing Auction Infrastructure (Do Not Duplicate)

The following auction-adjacent code already exists and must be built on — not replaced:

- `watchlist` table in Supabase with `(user_id, card_id)` pairs + real-time sync via Supabase channels
- `useWatchlist()` hook with optimistic updates
- `auction_end_at` field on listings
- `listing_type: "auction"` field on `user_vaults`
- `useCountdown(endAt)` hook rendering "Xd Yh Zm" / "Ended"
- Auction countdown display on: AccountWatchlist, ProductDetailPage, CardDetailsPage, CollectionPage, VaultCategoryPage, WhatnotShowsPage, MarketplacePage
- Grading badge component (PSA/BGS/CGC/SGC colour-coded)

### 3.4 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v7, Vite, lazy-loaded pages |
| UI | shadcn/ui (New York style, Radix UI), Tailwind CSS, Lucide icons |
| Animation | Framer Motion, tailwindcss-animate |
| Forms | react-hook-form + Zod |
| Toasts | Sonner |
| Theming | CSS variables, next-themes (dark mode) |
| Charts | Recharts |
| **Database** | **Supabase (PostgreSQL)** — single source of truth for all data |
| Auth | Supabase Auth (email/password + MFA) |
| Real-time | Supabase Realtime channels (already in use for watchlist) |
| File storage | Supabase Storage |
| Server functions | Supabase Edge Functions (Deno) — replace all PocketBase hooks |
| Payments | Stripe (checkout sessions + webhooks) |
| eCommerce | Hostinger Ecommerce API |
| Market data | eBay API with server-side caching |
| Backend | Express.js (port 3001), proxied via `/hcgi/api` |
| Monitoring | Datadog synthetic tests + Vercel Analytics + Speed Insights |
| Deployment | GitHub Actions → Hostinger FTP (frontend) |

> **Architecture decision (June 2026):** PocketBase is removed entirely. All data, auth, real-time, file storage, and server-side automation move to Supabase. This simplifies the infrastructure from a dual-database system to a single, managed platform and aligns with the existing Supabase Auth and Realtime usage already in the codebase.

### 3.5 Supabase Core Schema (Current)

```sql
-- Enums
card_condition: mint | near_mint | excellent | good | light_played | played | poor
listing_status: draft | active | sold | archived
order_status:   pending | payment_confirmed | shipped | delivered | cancelled | refunded
user_role:      buyer | seller | admin

-- Core tables
profiles       (id → auth.users, username, display_name, avatar_url, bio, role,
                location_state, is_verified, stripe_account_id)
categories     (id, name, slug, description, image_url, sort_order)
cards          (id, seller_id, category_id, title, description, card_name, set_name,
                card_number, year, is_foil, is_graded, grading_company, grade,
                price_aud, condition, status, quantity, accepts_offers,
                ships_nationwide, shipping_cost_aud, tags[])
card_images    (id, card_id, storage_path, is_primary, sort_order)
orders         (id, buyer_id, seller_id, card_id, quantity, unit_price_aud,
                shipping_aud, total_aud, status, stripe_payment_intent_id,
                shipping_name/address/suburb/state/postcode, tracking_number)
watchlist      (id, user_id, card_id) [unique: user_id + card_id]
reviews        (id, order_id, reviewer_id, seller_id, rating 1–5, comment)
                [unique: order_id — one review per order]
```

### 3.6 Route Structure

```
/                    Home
/marketplace         Browse marketplace
/auctions            ← NEW: Live auction hub
/markets             Market price data
/shop                Sealed product shop
/collections         Collection management
/vault               Personal vault
/grading             Grading guides
/community           Community & events
/blog                Blog
/account             Account dashboard
/admin               Admin panel
/info                Info pages (about, privacy, terms, FAQ, shipping, trust)
```

---

## 4. Strategic Vision & Goals

### 4.1 North Star

> CardPop Australia is the safest, most trusted, and most exciting place for Australian collectors to buy, sell, trade, and auction trading cards — online, any time, with the feel of a real card show.

### 4.2 Strategic Goals (12–24 months)

1. **Trust as a moat** — Australia's most rigorous seller verification and buyer protection system. Trust is the brand's core differentiator and must be structurally enforced, not just promised.

2. **Auctions as the growth engine** — Live user-run auctions create urgency, engagement, and repeat visits. This is the primary acquisition and retention lever for 2026.

3. **Community creates stickiness** — Collector profiles, reputation systems, forums, and trade history keep users on-platform rather than retreating to Facebook groups or Discord.

4. **Data creates defensibility** — eBay pricing, AI card identification, market analytics, and grading data create a knowledge layer competitors can't easily replicate.

5. **Mobile-first execution** — Australian collectors use phones at shows. Every auction, listing, and bid must be fully functional on mobile.

### 4.3 Business Model Levers

| Revenue Stream | Phase | Description |
|---|---|---|
| Listing fees | Current | Free or fee-based card listings |
| Shop margin | Current | Hostinger ecommerce product margin |
| Auction final-value fee | Phase 2 | % of hammer price on user auctions |
| Platform auction margin | Phase 3 | CardPop-run auctions on consignment |
| Premium seller tiers | Phase 2–3 | PowerSeller / Elite subscription features |
| Featured listings | Future | Promoted placement in marketplace |
| Grading referral | Future | PSA/BGS referral partnerships |

---

## 5. Platform Architecture Blueprint

### 5.1 Module Map (Future-Proof Structure)

Six top-level product modules. All current and future features slot into one of these:

```
CardPop Australia
├── IDENTITY          User accounts, auth, verification, seller tiers, reputation
├── MARKETPLACE       Browse, search, buy-now, fixed-price listings
├── AUCTIONS          Live auctions, bidding engine, user-run & platform-run
├── TRADE             Peer-to-peer card trades, offer system, escrow
├── VAULT             Card storage records, grading tracking, collection management
├── COMMUNITY         Blog, forums, events, shows, leaderboards, activity feed
└── PLATFORM          Admin, analytics, trust & safety, seller tools, CMS
```

### 5.2 Frontend Page Structure (Target State)

Builds on the existing 133-page structure. New pages are marked `← NEW`.

```
pages/
├── home/           HomePage.jsx
├── marketplace/
│   ├── MarketplacePage.jsx
│   ├── MarketplaceCategoryPage.jsx
│   ├── MarketplaceListingPage.jsx / ProductDetailPage.jsx
│   └── BrowseListingsPage.jsx
├── auctions/                                    ← NEW module
│   ├── AuctionHub.jsx                           ← Browse all live auctions
│   ├── AuctionDetail.jsx                        ← Live auction room (real-time)
│   ├── CreateAuction.jsx                        ← Seller: create/configure auction
│   ├── MyAuctions.jsx                           ← Seller: manage my auctions
│   └── AuctionHistory.jsx                       ← Buyer/seller auction history
├── markets/
│   ├── MarketsPage.jsx
│   ├── MarketDetailPage.jsx
│   └── CardAnalyticsPage.jsx
├── shop/           (existing)
├── collections/    (existing)
├── vault/          (existing)
├── grading/        (existing)
├── community/      (existing)
├── blog/           (existing)
├── account/
│   ├── AccountDashboard.jsx
│   ├── AccountProfile.jsx
│   ├── AccountVault.jsx
│   ├── AccountListings.jsx
│   ├── AccountWatchlist.jsx
│   ├── AccountWallet.jsx
│   ├── AccountTransactions.jsx
│   ├── AccountOffers.jsx
│   ├── AccountReviews.jsx
│   ├── AccountSecurity.jsx
│   ├── AccountNotifications.jsx
│   └── AccountAuctions.jsx                      ← NEW: my auctions tab
├── admin/
│   ├── (all existing admin pages)
│   ├── AdminAuctions.jsx                        ← NEW: moderate auctions
│   └── AdminTrustSafety.jsx                     ← NEW: reports, disputes dashboard
└── info/
    ├── (all existing info pages)
    └── AuctionRules.jsx                         ← NEW: auction T&Cs (pre-launch)
```

### 5.3 Backend Route Structure (Target State)

```
src/routes/
├── auth/index.js          (existing) login, MFA, sessions, devices
├── ebay.js                (existing) price lookups, trending, sales data
├── stripe.js              (existing) checkout, webhooks, invoices
├── integrated-ai.js       (existing) AI chat, suggestions
├── card-ocr.js            (existing) image identification
├── categories.js          (existing) CRUD + subcategories
├── vault.js               (existing) vault security operations
├── event-scraper.js       (existing) Whatnot + eBay event scraping
├── auctions/              ← NEW module
│   ├── index.js           router aggregator
│   ├── auctions.js        CRUD for auction records + state machine
│   ├── bids.js            bid placement, validation, anti-sniping
│   └── notifications.js   auction event triggers (email + in-app)
├── sellers.js             ← NEW seller profile API + tier management
└── disputes.js            ← NEW trust & safety dispute resolution
```

### 5.4 Real-Time Architecture

**Use Supabase Realtime** (already in the codebase for watchlist sync) — not PocketBase SSE, not Socket.io. This keeps the architecture consistent and avoids new infrastructure.

```
Frontend subscribes to auction channel:
  supabase.channel('auction:' + auctionId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids',
        filter: 'auction_id=eq.' + auctionId }, handleNewBid)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions',
        filter: 'id=eq.' + auctionId }, handleAuctionUpdate)
    .subscribe()
```

**Critical:** Bid placement must go through the Express backend, never directly to Supabase from the client. This ensures server-side validation, anti-snipe logic, and race-condition safety before any DB write.

### 5.5 Bid Placement Data Flow

```
User places bid
      ↓
POST /hcgi/api/auctions/:id/bids   (Express backend)
      ↓
authMiddleware → validate Supabase token
      ↓
Server-side bid validation:
  ✓ Bid > (current_price + min_increment)
  ✓ User is verified (email verified, not suspended)
  ✓ User !== auction.seller_id
  ✓ Auction state === 'live' or 'ending_soon'
  ✓ Account age ≥ minimum (configurable, default 7 days)
      ↓
BEGIN Supabase transaction:
  INSERT into bids (auction_id, bidder_id, amount)
  UPDATE auctions SET
    current_price = bid.amount,
    highest_bidder_id = bid.bidder_id,
    bid_count = bid_count + 1,
    -- anti-snipe: if (end_time - now) < snipe_window, extend
    end_time = CASE
      WHEN end_time - now() < interval '3 minutes'
      THEN now() + interval '3 minutes'
      ELSE end_time
    END,
    state = CASE
      WHEN end_time - now() < interval '3 minutes' THEN 'ending_soon'
      ELSE state
    END
  WHERE id = auction_id
COMMIT
      ↓
Supabase Realtime fires to all subscribers in the auction channel
      ↓
All connected clients update UI instantly (no polling)
      ↓
Outbid notification queued for previous highest bidder
```

---

## 6. Feature Roadmap

### Phase 0 — PocketBase → Supabase Migration (Parallel with Phase 1)

> This is a foundational prerequisite. Run in parallel with Phase 1, completing before Phase 2 auction work starts.

**Collections to migrate (PocketBase → Supabase tables):**
- `blog_articles` / `articles` → `public.articles`
- `discussions` / `communityForums` → `public.discussions`
- `comments` → `public.comments`
- `events` → `public.events`
- `market_data` → `public.market_data`
- `integratedAiMessages` → `public.ai_messages`
- `auditLogs` → `public.audit_logs`
- `gradingScales` / `certifications` → `public.grading_scales`
- `appSettings` → `public.app_settings`
- `marketplaceStructure` → merge into `public.categories` / `public.app_settings`
- All remaining content collections

**Hooks to migrate (PocketBase → Supabase Edge Functions):**
- All 18 `pb_hooks/*.js` scripts → corresponding Edge Functions (see Section 9.3)
- Email template (`cpEmail()` function) → shared Edge Function utility module

**Data to migrate:**
- All existing PocketBase records → Supabase via one-time migration script
- Supabase Storage for all file/image assets currently on PocketBase file storage

**Decommission:** (completed — PocketBase has been fully removed)
- [x] Remove `pocketbase` npm dependency from `package.json`
- [x] Remove `lib/pocketbaseClient.js` and all `pb` imports across the frontend
- [x] Replace all `pb.collection(...)` calls with `supabase.from(...)` equivalents
- [x] Remove `pb_migrations/` and `pb_hooks/` directories
- [x] Remove Express backend calls to `localhost:8090`

---

### Phase 1 — Trust Foundation Hardening (Now → Month 2)

These must be solid before auctions go live. Auctions built on shaky trust damage the brand permanently.

- [ ] Seller tier badges wired to UI (Verified / PowerSeller / Elite) on all listing surfaces
- [ ] Seller stats visible on all listing cards: sales count, rating, join date
- [ ] "Protected Trade" lock icon implemented on eligible transaction checkout
- [ ] Buyer protection messaging at Stripe checkout
- [ ] 5-star review system enforced (min 3 reviews before aggregate displays)
- [ ] Report / flag system accessible on every listing and user profile
- [ ] Dispute workflow (open → under review → resolved)
- [ ] Auction Rules page `/info/auction-rules` (legally required before launch)
- [ ] Terms of Service final review
- [ ] WCAG AA contrast audit on all current UI
- [ ] Mobile responsiveness audit across all 133 pages

### Phase 2 — Live Auction Platform (Month 2 → Month 5)

See Section 7 for detailed requirements.

**Data (Supabase migrations):**
- [ ] `auctions` table migration
- [ ] `bids` table migration
- [ ] `auction_notifications` table migration
- [ ] `disputes` table additions (extend existing or new)
- [ ] Update `listing_status` enum to include auction states

**Backend (Express routes):**
- [ ] `/auctions` CRUD + state machine
- [ ] `/auctions/:id/bids` — bid placement with validation + anti-snipe
- [ ] `/auctions/:id/publish` — draft → live transition
- [ ] Auction notification service (email + in-app triggers)
- [ ] Stripe PaymentIntent creation on auction end

**Frontend pages:**
- [ ] `AuctionHub.jsx` — browse, filter, sort all live auctions
- [ ] `AuctionDetail.jsx` — live room with real-time bid feed
- [ ] `CreateAuction.jsx` — seller auction configuration wizard
- [ ] `MyAuctions.jsx` — seller management dashboard
- [ ] `AuctionHistory.jsx` — buyer/seller history
- [ ] `AccountAuctions.jsx` — account tab integration
- [ ] `AdminAuctions.jsx` — admin moderation

**Realtime & notifications:**
- [ ] Supabase Realtime subscription wired in AuctionDetail
- [ ] In-app notification centre (drawer or bell icon in nav)
- [ ] Email notifications for all auction events (see Section 7.11)
- [ ] Outbid push notification (if mobile PWA)

### Phase 3 — Platform Auctions & Advanced Trust (Month 6+)

- [ ] CardPop-curated/hosted auctions (consignment model)
- [ ] Escrow / hold-in-vault flow for items > $500
- [ ] PowerSeller and Elite tier subscription features
- [ ] Auction scheduling (pre-announce, countdown, "remind me")
- [ ] Seller analytics dashboard (views, bids, conversion, earnings)
- [ ] Grading referral integration (PSA/BGS submission tracking)
- [ ] Community activity feed / leaderboards
- [ ] Mobile PWA upgrade (or React Native)
- [ ] Multi-currency groundwork (NZD first)

---

## 7. Live Auction Platform — Detailed Requirements

### 7.1 Core Principles

- **User-run first** — registered, verified users create and run their own auctions. CardPop is the platform, not the seller.
- **Trust by default** — every auction must display full seller trust signals. Anonymous auctions are not permitted.
- **Real-time, not fake-time** — live bid updates must be genuinely real-time via Supabase Realtime. Collectors know the difference.
- **Mobile is primary** — auction rooms must be fully functional on a phone screen including bid placement.
- **Anti-sniping is a feature, not a footnote** — the platform automatically extends auctions when bids land in the final window. This is advertised prominently.
- **Bids are binding** — no retractions. Consistent with Australian market norms and the brand's trust positioning.

### 7.2 User Roles in Auctions

| Role | Permissions |
|---|---|
| Auction Creator / Seller | List, configure, publish, cancel (pre-bid), view bidder info post-settlement |
| Bidder | Any authenticated user with verified email, aged ≥ 7 days, not the seller |
| Watcher | Any user who has watchlisted the auction — receives ending-soon notifications |
| CardPop Admin | Moderate, pause, cancel any auction; override any rule; full audit view |

### 7.3 Auction Lifecycle States

```
DRAFT → SCHEDULED → LIVE → ENDING_SOON → ENDED → SETTLED
                                                 ↘ RESERVE_UNMET
                                                 ↘ CANCELLED
```

| State | Trigger | Bidding |
|---|---|---|
| `draft` | Seller creating | No |
| `scheduled` | Published with future start | No (watchable) |
| `live` | Start time reached | Yes |
| `ending_soon` | Bid lands within snipe window | Yes |
| `ended` | end_time passed | No |
| `settled` | Payment captured | No |
| `reserve_unmet` | Ended, reserve not reached | No |
| `cancelled` | Seller/admin before first bid | No |

### 7.4 Auction Configuration

| Field | Required | Notes |
|---|---|---|
| Title | Yes | Card name + grade + year + set recommended |
| Description | Yes | Condition notes, any flaws |
| Card category | Yes | From `categories` taxonomy |
| Photos | Yes | Min 2, max 10; Supabase Storage |
| Starting price (AUD) | Yes | Min $1.00 |
| Reserve price (AUD) | No | Hidden from bidders; if unmet, seller can re-list |
| Buy It Now price (AUD) | No | Ends auction immediately if accepted |
| Min bid increment | Yes | Default: $1 (<$50), $5 (<$500), $10 (≥$500) |
| Duration | Yes | 1h / 3h / 6h / 12h / 24h / 3 days / 7 days |
| Scheduled start | No | Defaults to immediate on publish |
| Shipping options | Yes | Australia Post estimate + pickup option |
| Returns policy | Yes | Accepts returns (7 days) / No returns |

### 7.5 Anti-Snipe Logic

If a bid lands within the **final 3 minutes** of an auction, `end_time` is automatically extended by **3 minutes** from the bid time. Repeats indefinitely until no bid lands in the window.

Required UI behaviour:
- "Auction extended — late bid received" toast fires to all watching clients
- Time remaining display re-animates to reflect new end_time
- Extension count shown: "Extended 2× due to late bids"
- Documented on `/info/auction-rules` page

Admin controls (configurable):
- Snipe window duration (default: 3 minutes)
- Extension duration (default: 3 minutes)
- Max extensions per auction (default: unlimited)

### 7.6 Bid Validation Rules (Server-Side, Non-Negotiable)

All of the following are enforced in the Express route — never client-side only:

1. `bid.amount > auction.current_price + auction.min_increment`
2. `bid.bidder_id !== auction.seller_id`
3. `profile.email_confirmed === true`
4. `profile.suspended !== true`
5. `auction.state IN ('live', 'ending_soon')`
6. `now() < auction.end_time`
7. Account age: `profile.created_at < now() - interval '7 days'` (configurable)
8. Bid velocity: max 10 bids per minute per user (rate limiter on the route)

### 7.7 Auction Hub Page (`/auctions`)

- Card grid using the brand's product card component with live data
- "LIVE" red pill badge on running auctions
- "ENDING SOON" badge (flashing) on auctions in the snipe window
- Countdown timer on every card
- Seller trust badge inline on every card
- Filters: category, game/set, grade (PSA/BGS/CGC/raw), price range, time remaining
- Sort: ending soonest, newest, price low/high, most bids
- Empty state: "No auctions right now — check back soon or create one"

### 7.8 Auction Detail Page (`/auctions/:id`)

**Left panel (item):**
- Swipe-able image gallery with lightbox (mobile: carousel)
- Card name, grade badge (CardPop Red pill), category label, year, set
- Description with "Read more" expand
- Seller trust card: avatar, tier badge, star rating, sales count, join date
- Shipping: estimated cost, method, timeframe
- Link: "Read Auction Rules →"

**Right panel (live bidding):**
- Current price — large, Syne ExtraBold, prominent
- Bid count ("42 bids")
- Countdown timer — turns CardPop Red at 3 minutes remaining
- Bid input field + "Place Bid" CTA (CardPop Red, disabled unless authenticated)
- "Buy It Now" button (if configured)
- "Watch Auction" heart button (adds to watchlist)
- Anti-snipe notice: always visible, not hidden in FAQ
- Live bid feed — last 10 bids, username (masked: "j***s"), amount, time ago
- Reserve status: "Reserve not yet met" / "Reserve met ✓" (after passing threshold)
- Winner panel (post-end): payment CTA for winner, shipment CTA for seller

**Real-time behaviour (via Supabase channel):**
- Current price and bid count update without page reload
- New bid appears at top of feed with card-reveal animation (300ms ease-out)
- Price field flashes CardPop Red border for 600ms on update
- Countdown re-syncs on anti-snipe extension
- Toast fires to all watchers: "Late bid! Auction extended by 3 minutes"

### 7.9 Create Auction Flow (`/auctions/create`)

Multi-step wizard (not a single long form):

1. **Item details** — title, description, category, card attributes (name, set, year, grade)
2. **Photos** — drag-drop upload to Supabase Storage (min 2 required to proceed)
3. **Pricing** — starting price, optional reserve, optional Buy It Now, increment selection
4. **Duration & schedule** — pick duration, optional future start time
5. **Shipping** — shipping options and cost, pickup option
6. **Review & publish** — summary of all fields, link to Auction Rules, confirm & publish

Validation:
- Each step validates before proceeding
- Step 5 requires at least one shipping option
- Step 6 requires explicit checkbox: "I have read and agree to the CardPop Auction Rules"
- First-time sellers: "Your first auction will be reviewed before going live (usually within 2 hours)"

### 7.10 Seller Auction Management (`/account/auctions`)

- Tabs: Active / Scheduled / Ended / Settled / Cancelled
- Per-auction quick stats: current bids, current price, watcher count, time remaining
- Actions: Edit (draft only), Cancel (pre-first-bid), View details
- Earnings summary: gross, platform fee deducted, net (per settled auction)
- "Create New Auction" primary CTA

### 7.11 Payment & Settlement

- On auction end with bids ≥ reserve (or no reserve): trigger Stripe PaymentIntent for winning bidder
- Buyer has **48 hours** to complete payment before dispute auto-opens
- Non-payment strike: 3 strikes → account suspension from bidding (configurable)
- Platform fee deducted at payment capture before seller disbursement
- Proposed fee: **5% of hammer price, capped at $50 per auction**
- Fee is displayed transparently on the Create Auction confirmation step

### 7.12 Notifications

| Event | In-App | Email | Who |
|---|---|---|---|
| Auction published | ✅ | — | Seller |
| First bid received | ✅ | ✅ | Seller |
| Outbid | ✅ | ✅ | Previous highest bidder |
| Ending soon (1hr remaining) | ✅ | ✅ | All watchers |
| Anti-snipe extension | ✅ (toast) | — | All watching clients |
| Auction ended — winner | ✅ | ✅ | Winning bidder |
| Auction ended — seller | ✅ | ✅ | Seller |
| Reserve not met | ✅ | ✅ | Seller |
| Buy It Now accepted | ✅ | ✅ | Both parties |
| Payment due reminder (24hr) | ✅ | ✅ | Winning bidder |
| Payment received | ✅ | ✅ | Both parties |
| Non-payment dispute opened | ✅ | ✅ | Both parties |

---

## 8. Trust & Safety Framework

Trust is CardPop's primary brand differentiator. It must be **structurally enforced** — not just visually communicated.

### 8.1 Seller Verification Tiers

| Tier | Requirements | Badge |
|---|---|---|
| **Registered** | Email verified | — |
| **Verified** | Email + government ID check | Green shield |
| **PowerSeller** | Verified + 50+ completed sales + ≥ 97% positive feedback | Blue shield + star |
| **Elite** | PowerSeller + 200+ sales + manual CardPop review | Gold shield + star |

- **Only Verified and above users can create auctions** (enforced server-side)
- ID verification handled in the existing `AdminVerificationDashboard` flow
- Tier is stored on `profiles.is_verified` (boolean today; extend to tier enum in Phase 2)

### 8.2 Buyer Protection

- "Protected Trade" indicator on all eligible transactions (lock icon per brand guide)
- Dispute resolution: buyer has 7 days post-delivery to raise a claim
- Escrow for high-value items (Phase 3: items > $500)
- Non-payment strike system (3 strikes = suspended from bidding)
- Admin dispute dashboard with audit trail

### 8.3 Anti-Fraud Measures

| Measure | Implementation |
|---|---|
| Bid velocity limiting | Express rate limiter: max 10 bids/min per user on `/bids` route |
| Account age minimum | Server-side: account must be ≥ 7 days old to bid |
| Shill bidding detection | PocketBase hook: flag bids from same IP or linked devices |
| First-auction review | Seller's first 5 auctions require admin approval before going live |
| Suspicious pattern flagging | Audit log analysis + admin alert queue |
| Device fingerprinting | Existing device trust system in auth layer |

### 8.4 Report & Dispute Flow

```
User clicks "Report" on listing/auction/user
      ↓
Modal: select reason (counterfeit, misrepresentation, shill bidding, other)
      ↓
Report stored in disputes table, assigned to admin queue
      ↓
Admin reviews: actions available (warn, remove listing, suspend user)
      ↓
Resolution recorded in audit log
      ↓
Reporter notified of outcome
```

---

## 9. Technical Architecture

### 9.1 New Supabase Migrations Required

#### `auctions` table

```sql
create type auction_state as enum (
  'draft', 'scheduled', 'live', 'ending_soon',
  'ended', 'settled', 'reserve_unmet', 'cancelled'
);

create table public.auctions (
  id                    uuid primary key default uuid_generate_v4(),
  seller_id             uuid not null references public.profiles(id),
  card_id               uuid references public.cards(id),   -- optional link to existing card
  title                 text not null,
  description           text,
  category_id           uuid references public.categories(id),

  -- Photos stored in Supabase Storage
  photo_paths           text[] not null default '{}',

  -- Pricing
  starting_price        numeric(10,2) not null check (starting_price >= 1),
  reserve_price         numeric(10,2),                      -- null = no reserve
  buy_it_now_price      numeric(10,2),
  current_price         numeric(10,2) not null,             -- updated on each bid
  min_increment         numeric(8,2) not null default 1,

  -- Bidding state
  bid_count             int not null default 0,
  highest_bidder_id     uuid references public.profiles(id),
  reserve_met           boolean not null default false,

  -- Timing
  duration_hours        int not null,
  start_time            timestamptz not null default now(),
  end_time              timestamptz not null,
  snipe_window_minutes  int not null default 3,
  extension_count       int not null default 0,

  -- State
  state                 auction_state not null default 'draft',

  -- Logistics
  shipping_options      jsonb not null default '[]',        -- [{method, cost_aud, days}]
  returns_accepted      boolean not null default false,

  -- Fees
  platform_fee_pct      numeric(4,2) not null default 5.0,
  stripe_payment_intent_id text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index auctions_state_idx         on public.auctions(state);
create index auctions_end_time_idx      on public.auctions(end_time);
create index auctions_seller_id_idx     on public.auctions(seller_id);
create index auctions_category_id_idx   on public.auctions(category_id);
```

#### `bids` table

```sql
create table public.bids (
  id           uuid primary key default uuid_generate_v4(),
  auction_id   uuid not null references public.auctions(id) on delete cascade,
  bidder_id    uuid not null references public.profiles(id),
  amount       numeric(10,2) not null,
  is_winning   boolean not null default false,
  ip_hash      text,                                        -- hashed, for shill detection
  placed_at    timestamptz not null default now()
);

create index bids_auction_id_idx on public.bids(auction_id);
create index bids_bidder_id_idx  on public.bids(bidder_id);
```

#### `auction_notifications` table

```sql
create type auction_notif_type as enum (
  'outbid', 'ending_soon', 'auction_ended', 'auction_won',
  'reserve_met', 'payment_due', 'payment_received',
  'anti_snipe_extension', 'dispute_opened'
);

create table public.auction_notifications (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  auction_id   uuid references public.auctions(id) on delete set null,
  type         auction_notif_type not null,
  read         boolean not null default false,
  metadata     jsonb default '{}',
  created_at   timestamptz not null default now()
);

create index auction_notifs_user_id_idx on public.auction_notifications(user_id);
create index auction_notifs_read_idx    on public.auction_notifications(user_id, read);
```

#### `disputes` table extension

```sql
create type dispute_type as enum (
  'non_payment', 'item_not_received', 'item_not_as_described',
  'shill_bidding', 'counterfeit', 'other'
);

create type dispute_status as enum (
  'open', 'under_review', 'resolved', 'escalated'
);

create table public.disputes (
  id             uuid primary key default uuid_generate_v4(),
  auction_id     uuid references public.auctions(id),
  reporter_id    uuid not null references public.profiles(id),
  reported_id    uuid not null references public.profiles(id),
  type           dispute_type not null,
  status         dispute_status not null default 'open',
  description    text,
  resolution     text,
  admin_id       uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

#### Extend `profiles` for seller tiers

```sql
create type seller_tier as enum ('registered', 'verified', 'powerseller', 'elite');

alter table public.profiles
  add column seller_tier    seller_tier not null default 'registered',
  add column total_sales    int not null default 0,
  add column avg_rating     numeric(3,2),
  add column review_count   int not null default 0,
  add column suspended      boolean not null default false,
  add column suspended_reason text;
```

### 9.2 New Express Routes

```
POST   /auctions                     Create draft auction (auth, seller_tier >= verified)
GET    /auctions                     List/search auctions (public, filters + pagination)
GET    /auctions/:id                 Get auction detail (public)
PATCH  /auctions/:id                 Update draft auction (seller only)
POST   /auctions/:id/publish         Draft → scheduled or live
DELETE /auctions/:id                 Cancel (seller, before first bid, or admin)
POST   /auctions/:id/bids            Place bid (auth, verified email, not seller)
GET    /auctions/:id/bids            Bid history (public, amounts + masked usernames)
POST   /auctions/:id/buy-now         Accept Buy It Now price (auth, not seller)
GET    /notifications                User's auction notifications (auth)
PATCH  /notifications/:id/read       Mark notification read (auth)
PATCH  /notifications/read-all       Mark all read (auth)
POST   /disputes                     Open a dispute (auth)
GET    /disputes/:id                 Get dispute detail (auth, admin)
PATCH  /disputes/:id                 Update dispute status (admin)
GET    /sellers/:id                  Public seller profile + stats
PATCH  /sellers/tier                 Update seller tier (admin)
```

### 9.3 Supabase Edge Functions (Replacing PocketBase Hooks)

All automation previously in PocketBase hooks is migrated to **Supabase Edge Functions** (Deno/TypeScript). Email delivery uses Resend or SendGrid via the Edge Function — retaining the existing CardPop-branded email template styling.

| Function | Trigger | Purpose |
|---|---|---|
| `on-user-signup` | Auth webhook → `auth.users` insert | Send verification email, create profile defaults |
| `on-auction-end` | Database webhook → `auctions.state` → 'ended' | Notify winner + seller, create Stripe PaymentIntent |
| `on-bid-placed` | Database webhook → `bids` insert | Send outbid email to previous highest bidder |
| `on-auction-ending-soon` | Scheduled (cron, 1hr before end_time) | Notify all watchers |
| `on-trade-offer` | Database webhook → trade record insert | Trade offer received email |
| `on-review-created` | Database webhook → `reviews` insert | Update seller aggregate rating in `profiles` |
| `on-order-status-change` | Database webhook → `orders.status` update | Order confirmation, shipping update, delivery emails |
| `update-seller-stats` | Database trigger → `orders.status` = 'delivered' | Increment `profiles.total_sales` |
| `data-retention-cleanup` | Scheduled (daily) | Delete expired sessions and OTP records |
| `audit-log` | Database trigger (all admin tables) | Write to `audit_logs` table |

> **Migration note:** The 18 existing PocketBase hook scripts in `pb_hooks/` are the reference implementation. Each Edge Function replicates its logic. The `cpEmail()` email template styling must be preserved exactly for brand consistency.

### 9.4 Frontend Real-Time Integration Pattern

```js
// AuctionDetail.jsx — standard Supabase channel pattern (matches existing watchlist pattern)
import { supabase } from '@/lib/supabaseClient'

useEffect(() => {
  const channel = supabase
    .channel('auction:' + auctionId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'bids',
      filter: `auction_id=eq.${auctionId}`
    }, ({ new: bid }) => {
      setBidFeed(prev => [bid, ...prev].slice(0, 10))
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'auctions',
      filter: `id=eq.${auctionId}`
    }, ({ new: auction }) => {
      setCurrentPrice(auction.current_price)
      setEndTime(auction.end_time)
      setBidCount(auction.bid_count)
      setAuctionState(auction.state)
      if (auction.extension_count > prevExtensionCount) {
        toast.info('Auction extended — late bid received')
      }
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [auctionId])
```

### 9.5 Concurrency Safety

Bid placement must be atomic. Use a Supabase RPC (PostgreSQL function) rather than two separate UPDATE calls:

```sql
create or replace function place_bid(
  p_auction_id uuid,
  p_bidder_id  uuid,
  p_amount     numeric,
  p_ip_hash    text
) returns jsonb as $$
declare
  v_auction auctions%rowtype;
  v_new_end_time timestamptz;
begin
  -- Lock the auction row
  select * into v_auction from auctions
  where id = p_auction_id for update;

  -- Validate
  if v_auction.state not in ('live', 'ending_soon') then
    return jsonb_build_object('error', 'auction_not_live');
  end if;
  if p_amount < v_auction.current_price + v_auction.min_increment then
    return jsonb_build_object('error', 'bid_too_low');
  end if;

  -- Anti-snipe
  v_new_end_time := v_auction.end_time;
  if v_auction.end_time - now() < (v_auction.snipe_window_minutes * interval '1 minute') then
    v_new_end_time := now() + (v_auction.snipe_window_minutes * interval '1 minute');
  end if;

  -- Write bid
  insert into bids (auction_id, bidder_id, amount, is_winning, ip_hash)
  values (p_auction_id, p_bidder_id, p_amount, true, p_ip_hash);

  -- Unmark previous winner
  update bids set is_winning = false
  where auction_id = p_auction_id
    and bidder_id != p_bidder_id
    and is_winning = true;

  -- Update auction
  update auctions set
    current_price      = p_amount,
    highest_bidder_id  = p_bidder_id,
    bid_count          = bid_count + 1,
    end_time           = v_new_end_time,
    extension_count    = case when v_new_end_time != end_time then extension_count + 1 else extension_count end,
    state              = case when v_new_end_time - now() < (snipe_window_minutes * interval '1 minute')
                         then 'ending_soon'::auction_state else state end,
    reserve_met        = case when p_amount >= coalesce(reserve_price, 0) then true else reserve_met end,
    updated_at         = now()
  where id = p_auction_id;

  return jsonb_build_object('success', true, 'new_end_time', v_new_end_time);
end;
$$ language plpgsql security definer;
```

The Express bid route calls `supabase.rpc('place_bid', {...})` rather than chaining two separate calls.

---

## 10. Data Model

### 10.1 Entity Relationship

```
profiles ─────┬── auctions (seller)
              ├── auctions (highest_bidder)
              ├── bids (bidder)
              ├── orders (buyer / seller)
              ├── reviews (reviewer / seller)
              ├── watchlist (user)
              ├── auction_notifications
              └── disputes (reporter / reported / admin)

auctions ─────┬── bids
              ├── auction_notifications
              ├── disputes
              └── cards (optional: link to vault card record)

cards ─────── card_images
categories ── cards, auctions
```

### 10.2 Key Invariants

- A user cannot bid on their own auction (`bidder_id ≠ auction.seller_id`) — enforced in Express AND as a DB check constraint
- Reserve price is never returned in API responses to non-admin clients while the auction is live
- `end_time` can only be extended, never shortened
- `is_winning` on bids: only one bid per auction may have `is_winning = true`
- `reviews.order_id` is unique — one review per completed order only
- A user must be seller_tier ≥ `verified` to create an auction — enforced server-side

---

## 11. Design System Standards

### 11.1 Auction-Specific Components Needed

| Component | Location | Description |
|---|---|---|
| `<AuctionCard>` | `components/auctions/AuctionCard.jsx` | Grid tile: image, price, countdown, bid count, state badge, seller trust |
| `<LiveBidFeed>` | `components/auctions/LiveBidFeed.jsx` | Scrolling real-time bid log (masked usernames) |
| `<CountdownTimer>` | `components/auctions/CountdownTimer.jsx` | Live countdown using `useCountdown` hook; turns CardPop Red at 3 min |
| `<BidInput>` | `components/auctions/BidInput.jsx` | Controlled input, min enforced, Place Bid CTA, disabled when not live |
| `<AuctionStateBadge>` | `components/auctions/AuctionStateBadge.jsx` | "LIVE" / "ENDING SOON" / "SCHEDULED" / "ENDED" pills |
| `<SellerTrustCard>` | `components/auctions/SellerTrustCard.jsx` | Compact: avatar, tier badge, star rating, sales count |
| `<AntiSnipeNotice>` | `components/auctions/AntiSnipeNotice.jsx` | Persistent info box: always visible, explains extension |
| `<WinnerPanel>` | `components/auctions/WinnerPanel.jsx` | Post-auction: payment CTA for winner, shipping CTA for seller |
| `<ReserveIndicator>` | `components/auctions/ReserveIndicator.jsx` | "Reserve not yet met" / "Reserve met ✓" |
| `<NotificationBell>` | `components/ui/NotificationBell.jsx` | Nav icon with unread count badge |

### 11.2 Animation Specifications (From Brand Guide)

All auction animations must follow the brand guide motion system:

| Interaction | Spec |
|---|---|
| New bid in feed | 300–400ms ease-out · opacity 0→1 + translateY 8px→0 |
| Current price update | Flash CardPop Red border 600ms, then fade |
| Countdown turning red | Smooth colour transition at 3 minutes remaining |
| Bid CTA press | scale(0.97) · 80ms ease-in |
| State badge pop | scale(0)→(1) · 250ms spring |
| Anti-snipe toast | Sonner toast · CardPop Red accent · 5s duration |
| Page transition | Fade opacity 200ms ease-in-out |

Never add box-shadows for hover elevation — use border change only (per brand guide).

### 11.3 Mobile Auction Room Layout

At `< 768px` (4-column grid):
- Image gallery collapses to horizontal swipe carousel
- Bid history collapses behind "Show bid history (42 bids)" toggle
- Bid panel is fixed at bottom of screen (sticky footer)
- Countdown timer is always visible in a sticky header strip
- Place Bid button: full width, minimum 44×44px touch target
- Seller trust card collapses to single-line summary

### 11.4 Spacing & Grid Compliance

All auction UI must use the brand spacing tokens:

| Token | px | rem |
|---|---|---|
| xs | 4px | 0.25rem |
| sm | 8px | 0.5rem |
| md | 12px | 0.75rem |
| base | 16px | 1rem |
| lg | 24px | 1.5rem |
| xl | 32px | 2rem |
| 2xl | 48px | 3rem |
| 3xl | 64px | 4rem |

Desktop (1280px+): 12-column · 24px gutters · max-width 1200px

---

## 12. Compliance & Legal

### 12.1 Australian Regulatory Context

- All data handling governed by the **Privacy Act 1988 (Cth)** and **Australian Privacy Principles (APPs)** — Privacy Policy completed May 2026 ✅
- CardPop is a marketplace platform (not a financial product or financial service) — ASIC licensing not required unless escrow is operated as a separate financial service
- Consumer guarantees under the **Australian Consumer Law (ACL)** apply to item condition representations in all listings and auctions
- Transaction and order records must be retained for **7 years** (ATO GST record-keeping requirement)
- Anti-money laundering: minimise fund-holding to avoid AUSTRAC reporting obligations; prefer pass-through Stripe payments direct to seller accounts

### 12.2 Age Restriction

- Platform is 13+ minimum; 13–17 requires parental consent (per Privacy Policy)
- Email verification creates a practical age barrier
- ID verification (for seller_tier ≥ Verified) adds a hard age barrier

### 12.3 Legal Pages Status

| Page | Status | Required Before |
|---|---|---|
| Privacy Policy | ✅ Complete (May 2026) | Live |
| Terms of Service | ❌ Needs writing | Phase 1 |
| Auction Rules & Policies | ❌ Needs writing | Auction launch |
| Seller Agreement | ❌ Needs writing | Auction launch |
| Buyer Protection Policy | ❌ Needs writing | Auction launch |
| Cookie Policy | ❌ Needs writing | Phase 1 |

### 12.4 Auction-Specific Legal Requirements

The Auction Rules page (`/info/auction-rules`) must cover, at minimum:

- Binding bid policy (no retractions)
- Anti-snipe extension policy (window + extension durations disclosed)
- Reserve price policy (when auction settles vs. goes unsold)
- Non-payment consequences (strikes + account suspension)
- Dispute resolution timeline (SLAs)
- Seller eligibility requirements (Verified tier)
- Platform fee disclosure (% + cap)
- Prohibited items list
- CardPop's right to moderate or cancel any auction

---

## 13. Success Metrics

### 13.1 Platform Health KPIs (6 months post-auction launch)

| Metric | Target |
|---|---|
| Registered users | 2,500+ |
| Verified sellers | 500+ |
| Auctions created per month | 200+ |
| Auction completion rate | > 85% |
| Buyer non-payment rate | < 3% |
| Dispute rate | < 2% of settled auctions |
| Average seller rating | > 4.5 / 5.0 |
| Mobile traffic share | > 60% |
| Auction room LCP | < 2s |
| Real-time bid latency | < 500ms end-to-end |

### 13.2 Trust KPIs

| Metric | Target |
|---|---|
| Verified seller % of auctions | > 90% |
| Shill bid detections resolved | 100% within 24hrs |
| Dispute resolution time | < 72hr median |
| First-auction approval turnaround | < 2hrs (business hours) |

### 13.3 Engagement KPIs

| Metric | Target |
|---|---|
| Watchlist additions per auction | > 3 average |
| Bids per completed auction | > 8 average |
| Outbid-to-rebid rate | > 40% |
| Return visits (auction watchers, 7 days) | > 50% |

---

## 14. Open Questions & Decisions

Resolve these before Phase 2 implementation begins.

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | ID verification provider | Stripe Identity · Onfido · Manual admin review | Stripe Identity — already in Stripe ecosystem |
| 2 | Anti-snipe window duration | 2 min · **3 min** · 5 min | 3 minutes |
| 3 | Platform fee | Flat · **5% capped $50** · Tiered % | 5% capped at $50 |
| 4 | Reserve price reveal | Always hidden · **Reveal when met** | Reveal when met — builds trust |
| 5 | Bid retraction policy | **Never** · Within 1 min · Admin only | Never — binding bids are the trust signal |
| 6 | Seller first-auction approval | **Manual for first 5** · Automated threshold | Manual for first 5, then auto-approve |
| 7 | Account age minimum to bid | **7 days** · 14 days · 30 days | 7 days — balance safety and usability |
| 8 | Escrow scope | **Phase 3** · Phase 2 (> $500 only) | Phase 3 |
| 9 | Buy It Now on auctions | **Optional, seller configures** · Always / Never | Optional |
| 10 | Notification channel | **In-app + email** · Email only · Push (PWA) | In-app + email; push in Phase 3 |
| 11 | PocketBase migration sequencing | Which collections migrate first? What's the cutover strategy? | High-traffic tables last; blog/content first |
| 12 | Edge Function email provider | Resend · SendGrid · AWS SES | Resend — simple API, good AU deliverability |
| 13 | `.docx` URL Reference & AI Addendum | Review uploaded files — to be incorporated into routing and AI feature sections | Pending file review |

---

*CardPop Australia — PRD v1.1 · June 2026*
*Prepared for internal product and engineering use. Confidential.*
*cardpop.com.au · Explore. Trade. Collect.*
