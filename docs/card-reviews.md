# Card reviews & ratings — design proposal

Status: **proposal / exploration** — nothing here is built yet.

## Why this exists

Google Search Console reports two **non-critical** Product-snippet issues on the
card price-guide pages (`/prices/<category>/<slug>`, rendered by
`renderPriceCard` in `api/prerender.js`):

- Missing field `aggregateRating`
- Missing field `review`

These are advisory — the pages are already valid and eligible for the price
rich result via `Product` + `AggregateOffer`. They do **not** hurt ranking or
indexing. But if we want the star-rating rich result (and to clear the
warnings), the `Product` markup needs genuine `aggregateRating` / `review`
data **about the specific card**.

The short-term change already shipped separately: the card `Product` block now
carries the real recommended fields we already have (`image`, `url`,
`sku`/`mpn`). This document covers the longer path to legitimately populating
ratings.

## What we have today (audit)

There is **no per-card review or rating source** in the system. Every rating
store attaches to a seller/user profile or an order — never to a
`tracked_cards` row:

| Store | Keyed by | About | Card link? |
|---|---|---|---|
| `seller_ratings` | `seller_id` + `order_id` | a seller's conduct on a transaction | none |
| `reviews` | `recipient_id` / `seller_id` | a seller/user | none |
| `profiles.rating`, `profiles.reviews_count` | `profile.id` | a seller (aggregate) | none |
| `local_game_stores` | store id | — (no rating column) | none |
| `tracked_cards`, `card_price_snapshots` | card slug/category | the card (price only) | n/a |

`aggregateRating` is already emitted in three places in `api/prerender.js`
(trader list ~L209, dealer ~L291, seller profile ~L2058) — all sourced from
seller/profile ratings.

### Why we can't reuse any of it

Google's [product review-snippet guidelines](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
require the review/rating to be about **the specific product** on the page.
A seller-level or site-level rating applied to a card's `Product` markup
misrepresents a seller/marketplace rating as a product review — a policy
violation that risks a manual spam action. So reuse is off the table; a
card-scoped source has to be built.

## Proposed design

### 1. Data — `card_reviews` table

A new table scoped to a card, created via `supabase migration new card_reviews`
(never hand-numbered — see `CLAUDE.md`). Sketch:

```sql
create table if not exists public.card_reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.tracked_cards(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  -- moderation / trust
  is_visible boolean not null default true,
  flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, author_id)          -- one review per card per user
);
```

RLS: public `select` where `is_visible`; authenticated users may
`insert`/`update`/`delete` **their own** row only. Reuse the banned-words
flagging trigger pattern from `20260709084946_banned_words_flagging.sql`.

Optionally denormalise onto `tracked_cards` (`rating_avg numeric(3,2)`,
`reviews_count int`), updated by a trigger, so `renderPriceCard` reads one row
instead of aggregating on every crawl.

### 2. Write path

A backend route (`src/routes/card-reviews.js`) or a direct Supabase RLS
insert from the client. Prefer the backend route if we want server-side
banned-word checks / rate limiting, matching `src/routes/seller-ratings.js`.

### 3. UI surface

The card page is currently **prerender-only** (`api/prerender.js`) with no
interactive React view. To collect reviews we need the client-side
`CardPriceDetailPage.jsx` to render a review list + a "write a review" form
(auth-gated via `ProtectedRoute`), plus star display. Components to reuse:
`components/SellerRatingDisplay.jsx` for star rendering.

### 4. Structured data

Once real data exists, extend the `Product` block in `renderPriceCard`
(`api/prerender.js` ~L1805) with, only when there is at least one visible
review:

```js
...(reviewsCount > 0 ? {
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: avg.toFixed(1),
    reviewCount: reviewsCount,
  },
  review: topReviews.map(r => ({
    '@type': 'Review',
    reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
    author: { '@type': 'Person', name: r.author_name },
    ...(r.body ? { reviewBody: r.body } : {}),
    datePublished: r.created_at,
  })),
} : {}),
```

Keep it conditional — never emit an empty/zero rating.

## Google-policy guardrails (must-haves)

- **Real, first-party reviews only.** No fabricated, purchased, or incentivised
  reviews. No importing third-party ratings and attributing them to the card.
- **Ratings must be about the card**, not the seller or the site.
- **Only self-authored, visible, non-flagged** reviews feed the aggregate.
- Consider gating review submission to users who have transacted that card, to
  reduce spam — though Google does not require verified purchase for product
  reviews.

## Open questions (need product decisions)

1. **Who can review a card?** Any logged-in user, or only buyers/owners of that
   card? (Affects spam risk and whether we tie reviews to `orders`/`vault`.)
2. **Is a card review even a natural user action?** These are price-reference
   pages; users may not think to "review" a card the way they review a seller.
   Low review volume would mean the rich result rarely triggers — worth
   validating demand before building.
3. **Moderation load.** User-generated content adds a moderation surface
   (banned words, abuse, spam). Reuse the existing flagging pipeline.
4. **Is it worth it?** The warnings are non-critical and the pages already rank.
   This is a growth/rich-result play, not a fix for something broken.

## Recommendation

Treat this as an optional enhancement, not a bug fix. If review volume is
likely (or we gate to verified card owners), build it in the phased order
above: table + RLS → write route → UI on `CardPriceDetailPage.jsx` →
aggregation into `renderPriceCard`. If demand is uncertain, leave the two
non-critical warnings as-is (they are harmless) and revisit later.
