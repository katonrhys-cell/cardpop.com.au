---
name: search-cardpop
description: Search CardPop, Australia's trading card marketplace, for listings of a specific card (Pokémon, Magic, Yu-Gi-Oh, sports) and read the results.
license: proprietary
---

# Search CardPop for a card

CardPop (https://cardpop.com.au) is an Australian marketplace for trading cards.
This skill explains how an agent can search it for a card and read the results.

## When to use

Use this when a user wants to find a specific trading card for sale in Australia,
compare listings, or check availability — e.g. "find a PSA 10 Charizard on
CardPop", "is anyone selling Blue-Eyes White Dragon".

## How to search

CardPop's marketplace search is a plain GET with the query in the `q` parameter:

```
https://cardpop.com.au/marketplace?q=<url-encoded search terms>
```

Examples:
- `https://cardpop.com.au/marketplace?q=Charizard`
- `https://cardpop.com.au/marketplace?q=Blue-Eyes%20White%20Dragon`

The site-wide search (cards plus other content) lives at:

```
https://cardpop.com.au/search?q=<url-encoded search terms>
```

### In-browser agents (WebMCP)

If you are an agent running inside a browser on cardpop.com.au, the page exposes
WebMCP tools via `navigator.modelContext`. Prefer these over URL construction:

- `search_cards({ query })` — runs the marketplace search for `query`.
- `browse_section({ section })` — opens a public section (`marketplace`, `shop`,
  `prices`, `grading`, `community`, `events`, `card-shops`, `blog`, …).
- `get_site_overview()` — returns a JSON summary and the list of sections.

## Reading results

Marketplace and product pages are server-rendered for crawlers/agents (a bot
user-agent receives pre-rendered HTML with the listing title, price in AUD,
condition, seller and image). Request the page and parse that HTML. Individual
listings are at `https://cardpop.com.au/marketplace/<id>/<slug>`.

## Notes and limits

- Prices are in Australian dollars (AUD).
- Buying, making offers, watchlists and messaging require an authenticated user
  session; this skill is read-only (search and browse).
- Respect `https://cardpop.com.au/robots.txt` and a reasonable crawl rate.
