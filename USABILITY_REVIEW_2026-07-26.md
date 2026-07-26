# CardPop Usability Review — What Stands Between You and World-Class

**Date:** 2026-07-26
**Scope:** Critical review of the site as a user experiences it — navigation, first-time journeys, buying, selling, trading, search and trust — based on a full read of the frontend (App.jsx routing, Header/HeaderMenus, HomePage, MarketplacePage, ProductDetailPage, SearchResultsPage, CheckoutPage, AddEditCardPage, the signup → verify → card-on-file onboarding chain, and the trade surfaces).

This review deliberately does not repeat the engineering-level findings in `TRADING_BARRIERS_AUDIT.md` (payouts, order lifecycle, auth holes) except where they surface as user experience. It is about what a visitor sees, believes, and can actually do.

---

## The one-paragraph verdict

CardPop is polished in the places most sites neglect (performance, guest checkout, empty states, a genuinely good sell wizard) and broken in the one place a site cannot afford to be: **the core promise**. It is named and marketed as a *trading* card marketplace, the header shows a trade-requests icon, listings carry "For Trade" badges, and the product page has a big "Request Trade" button — and that button shows a *"Coming soon"* toast. There is no way to start a trade anywhere on the site. Layered on top is a homepage that displays invented statistics and a fictional sales feed. The path to "most intuitive card trading site in the world" starts not with adding features but with making sure **every visible promise is real and every visible button works**, then cutting the surface area down to the few journeys that matter.

---

## P0 — Broken promises (fix before anything else)

### 1. Trading does not exist, but the UI says it does
- `pages/ProductDetailPage.jsx:328-330` — "Request Trade" (and every other secondary action) resolves to `toast("Coming soon: …")`.
- There is **no trade-creation UI anywhere** in the codebase (no insert into `trades` from any page, hook or component). `TradeRequestsPage`, the header trade icon with its unread badge, the "For Trade" listing filter and badges all manage or advertise trades that can never be created.
- A user who lists a card "For Trade", or clicks the most prominent button on a trade listing, hits a dead end. Dead-end CTAs are the fastest way to teach users the site can't be trusted — they stop clicking *everything*.

**Do one of two things, immediately:**
- **Ship it:** a trade-proposal flow on the listing page — pick cards from your vault, optional cash top-up, review, send — backed by real server-side endpoints (see TRADING_BARRIERS_AUDIT §3 for why client-side Supabase writes aren't enough). This is the product's namesake feature; it should be the best flow on the site.
- **Or hide it:** the `enable_trading` platform flag already exists and gates `/trade-requests` and the header icon. Extend it to the "Request Trade" button, the "For Trade / For Sale & Trade" listing types in the sell wizard, the marketplace listing-type filter, and the trade badges. Flip it off until trading is real. "We don't have trading yet" is intuitive; "trading is everywhere but nothing happens" is not.

### 2. Fabricated trust signals on the homepage
- `pages/HomePage.jsx:87-92` — hardcoded stats: "12,400+ Cards Listed", "850+ Verified Sellers", "3,200+ Trades Completed", "4.9★ Average Rating". The trades number is provably false (see above — trades cannot occur). Collectors are precisely the community that cross-checks claims, and Australia's card scene is small and chatty.
- `pages/HomePage.jsx:135-144` — a fictional activity feed with invented usernames and sale prices ("@PokeTrader_SYD sold a PSA 10 Charizard — $2,400"). The code comments acknowledge it's illustrative and it renders without a "live" label — which means a reasonable visitor will read it as real. When one person notices "@MTG_Melbourne" doesn't exist, the screenshot ends up on a Facebook group and the brand damage is permanent.

**Do:** replace the stat tiles with real counts (cheap Supabase `count` queries, cached) and simply omit any metric that isn't impressive yet — "New this week" and "Cards in vaults" can be honest *and* good. Delete the activity feed until it can render real (anonymised) sales, or clearly label it as examples.

### 3. Sellers can't get paid (UX framing)
TRADING_BARRIERS_AUDIT covers the mechanics; the usability point is: **the most important user journey on a marketplace is "I sold something → money arrived."** Right now a seller's money arrives never, and there is no payout page to even watch. No amount of front-end polish outranks this. Stripe Connect onboarding + a "Earnings" tab in `/account` is a UX feature, not just infrastructure.

---

## P1 — Information architecture: too many doors, unclear labels

### 4. Two competing "buy" surfaces
"Shop" (`/shop` — supplies, sealed, affiliate products) and "Marketplace" (`/marketplace` — peer listings) sit side by side in the nav with no cue about which one sells *cards*. A first-time buyer wanting a Charizard has a coin-flip. World-class sites have **one** buy surface with facets (Singles / Sealed / Supplies / Peer vs Official).

**Do:** merge into a single "Buy" entry point — a landing page with the search bar and category tiles, faceted into marketplace listings and shop stock — or at minimum rename to self-explanatory labels ("Supplies & Sealed" vs "Card Marketplace") and cross-link each from the other's empty/no-results states.

### 5. Nav breadth vs. the three real jobs
Seven top-level sections (Shop, Marketplace, Analytics, Blog, Community, Events, Grading) plus mega-menus totalling ~30 destinations, over 100 public routes. The three jobs users come for — **buy a card, sell a card, check what a card is worth** — share space equally with Whatnot shows, business-building affiliate pages and forum profiles. Breadth is an SEO asset but a navigation liability.

**Do:** keep the SEO pages, but collapse the *nav* to five entries max: **Buy · Sell · Prices · Community · Grading** (Blog/Events/Analytics live inside Prices and Community). The header "Sell" button is already the right instinct — make the nav match it.

### 6. In-house jargon as primary labels
- "**Join Vault**" as the signup CTA: a new visitor doesn't know what a Vault is; the button doesn't say "create an account". Every competitor says Sign up / Join free.
- "Vault" for "my collection" is fine as a brand flourish *once inside*, but it's used before the concept is ever explained (`/vault/add` is where the header "Sell" button goes — selling and vault-keeping are conflated).
- "**Insider Trading**" (`/insider-trading`) — in a marketplace with real money, naming a page after securities fraud is a joke that reads as a red flag out of context.
- "Conviction Rating" — unexplained coinage in a nav/footer link.

**Do:** "Join Vault" → "Sign up — free". Keep Vault as flavour with a one-line explainer on first contact ("Your Vault is your collection"). Rename Insider Trading (e.g. "Market Movers") and put a plain-English subtitle on Conviction Rating.

### 7. Sports-card taxonomy imposed on everyone
The marketplace sidebar stacks **eight** always-visible dropdowns — Category, Franchise, Manufacturer, Team, Set, Parallel, Subset, plus "Popular players" — and the players list is 100% NBA (`MarketplacePage.jsx:29-40`). A Pokémon collector (your likely #1 audience) is shown Team, Rookie Card, and LeBron James. Meanwhile the filters that TCG buyers actually use — **condition, grade/graded-by, rarity, price-vs-market** — aren't facets at all.

**Do:** make facets contextual to the selected category: TCG → set, rarity, condition, graded (company/grade), language; Sports → team, player, rookie, parallel. Hide the rest. Show result counts per option, render active filters as removable chips, and **put filter state in the URL** (currently only `?q=` is) so back button, refresh and shared links work — table stakes for a browse surface.

---

## P2 — First-run and selling friction

### 8. Fintech-grade onboarding for a card site
The happy path for a new seller: signup form → confirm email → **Stripe ID verification (photograph passport + selfie)** → **put a credit card on file** → land on the wallet page. Each step is individually well-crafted (skippable, well-worded, secure) — but it's sequenced like a bank. The user hasn't seen a single card yet, and the reward for finishing is… a wallet screen.

The gates are also discovered *late*: the sell wizard lets you complete an entire listing and then tells you it is "NOT live yet — selling requires identity verification and a card on file" (`AddEditCardPage.jsx:1037`). Good that it saves the draft; bad that the requirements weren't visible when the user started.

**Do:**
- After email confirmation, land on **the marketplace** (or a "what do you want to do?" fork: *Start collecting / Start selling / Just browse*), not the verification chain. Defer ID + card-on-file to the moment of first listing, as a single combined "Activate selling — 2 steps, ~3 minutes" checklist with a progress bar.
- In the sell wizard, show a slim status strip at step 1 ("✓ Email · ✗ ID · ✗ Card on file — your listing will save as a draft until these are done") so nothing is a surprise at the end.
- Keep guest buying exactly as is — it's genuinely good (guest checkout with returning-email detection is better than most competitors).

### 9. The post-listing moment is silent
After publishing, sellers get a toast and a redirect to the vault. World-class flow: a success screen with the listing's public URL, share buttons, "what happens next" (how offers/messages arrive), and a nudge to list the next card. That screen is where single-listing users become 50-listing users.

---

## P3 — Search & discovery

### 10. Search is substring-matching in a hobby full of exact names
The `/search` page's grouped, ranked, fault-tolerant design is good. But matching is `ILIKE %token%`: no typo tolerance ("Charzard" → nothing), no synonym/abbreviation handling ("MTG", "poke"), no set-number awareness ("4/102"), and no suggestions as you type — the header SearchBar navigates on submit only. The empty state says "try a different spelling" — the site should be doing that for the user.

**Do (in order of value):**
1. Autosuggest dropdown on the header search: top card names, sets and sellers after 2 characters (a cached Supabase query is fine to start).
2. Postgres `pg_trgm` similarity for fuzzy fallback + a "Did you mean…?" row when results are thin.
3. Recent searches (localStorage) and recently-viewed cards — cheap, and they make the site feel personal.
4. Saved searches with email alerts ("new Umbreon VMAX under $200") — the single stickiest feature on TCGPlayer/Cardmarket, and you already have Resend + a notifications system.

### 11. No price anchor on listings
Listings show the seller's asking price in isolation. You have eBay pricing infrastructure and a whole `/prices` hub — but on the listing card and product page there's no "market ~$180 · this listing $165" context. That comparison is *the* decision-making datum for card buyers and the reason they'd choose CardPop's UI over eBay's.

**Do:** surface market price (with a trend arrow) on the product page first, listing cards second, and link it to the card's `/prices` page. This also converts your SEO price pages into marketplace funnels.

---

## P4 — Worth fixing, not urgent

- **`stockQuantity ?? 999`** on product add-to-cart (`ProductDetailPage.jsx:316`) — unknown stock treated as 999; a buyer can cart more than exists and find out at payment. Fail closed to 1 for marketplace singles.
- **Modal/scroll-lock band-aids** — Header runs a MutationObserver *plus* a 500ms interval to scrub stale `overflow:hidden` off `<body>` (`Header.jsx:91-142`). It works, but the underlying bug (navigating with a Radix Sheet/Dialog open) will keep spawning variants; route-change should close open layers, not clean up after them.
- **Login on desktop nav is `hidden xl:inline-flex`** — between `md` and `xl` widths there is no Login button, only "Join Vault"; existing users must know to click Join to find login. Show both from `md` up.
- **Mobile message/trade/notification icons** live only behind the hamburger (a small dot hints at them). For a messaging-centric marketplace, unread messages deserve a visible top-level affordance on phones.
- **Two search experiences**: header search → `/search`, marketplace sidebar search → filtered grid. Fine, but the header search on `/marketplace` should stay on the marketplace (it partially does via `?q=`) — make that behaviour consistent everywhere so search never "teleports" the user.
- **Accessibility**: aria-labels are unusually good; extend the same care to the filter sidebar (a `<fieldset>` per group, announced result-count updates via `aria-live`).

---

## What's already genuinely strong (keep it)

- **Performance engineering** — lazy chunks, prefetch-on-intent, eager LCP hero, framer-motion kept off phones. This is top-1% work and it directly serves usability.
- **Guest checkout** with returning-customer email detection and post-purchase account offer — better than most incumbents.
- **The sell wizard** — step validation, drafts, photo templates, full-form escape hatch for power users.
- **Skippable onboarding steps** with honest copy about *why* ID and card-on-file are needed.
- **Empty states and error boundaries** everywhere, with a route-reset error boundary.

---

## Suggested order of attack

| # | Action | Effort | Why first |
|---|--------|--------|-----------|
| 1 | Gate all trade UI behind `enable_trading` and turn it off (or build the propose-trade flow) | S (gate) / L (build) | Kills the worst dead end on the site |
| 2 | Real homepage stats; delete fictional activity feed | S | Trust is unrecoverable once lost |
| 3 | Stripe Connect payouts + Earnings tab | L | The marketplace isn't real without it |
| 4 | Nav consolidation to 5 entries; "Join Vault" → "Sign up"; rename Insider Trading | S | Every visitor touches the nav |
| 5 | Post-signup lands on marketplace; selling gates become one "Activate selling" checklist shown up-front in the wizard | M | Converts signups into listers |
| 6 | Contextual facets per category + filter state in URL | M | Makes browse usable for TCG (your core) |
| 7 | Search autosuggest + fuzzy matching | M | Search is the front door |
| 8 | Market-price anchor on product pages | M | The differentiator vs eBay |
| 9 | Saved searches + alerts, recently viewed | M | Retention engine |

Items 1, 2 and 4 are a week of work combined and would change what the site *feels* like more than any redesign.
