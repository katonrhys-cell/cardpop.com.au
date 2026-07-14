---
name: check-card-prices
description: Look up live Australian-dollar market prices and recent-sales trends for trading cards on CardPop.
license: proprietary
---

# Check trading card prices on CardPop

CardPop (https://cardpop.com.au) publishes live AUD market pricing for trading
cards, derived from recent sales. This skill explains how an agent finds pricing
for a card.

## When to use

Use this when a user asks what a card is worth in Australia, how a card's value
is trending, or to compare a listing's asking price against the market — e.g.
"what's a Base Set Charizard worth in AUD", "is this priced fairly".

## Where prices live

- **Prices hub:** `https://cardpop.com.au/prices` — browse and search market
  pricing by card and set.
- **Markets / trends:** `https://cardpop.com.au/markets` and
  `https://cardpop.com.au/australian-markets` — movement and demand across
  categories, Australia-specific.

These pages are server-rendered for agents/crawlers, so requesting the URL with
a bot user-agent returns readable HTML containing the card name and its AUD
price/figures. Parse that HTML.

## In-browser agents (WebMCP)

On cardpop.com.au the page exposes WebMCP tools via `navigator.modelContext`.
Use `browse_section({ section: "prices" })` to open the prices hub, or
`search_cards({ query })` to locate a specific card first.

## Notes and limits

- All figures are in Australian dollars (AUD).
- Prices reflect recent observed sales and move over time — treat them as
  indicative, not a guaranteed sale price.
- This skill is read-only. Buying/selling requires an authenticated session.
- Respect `https://cardpop.com.au/robots.txt` and a reasonable request rate.
