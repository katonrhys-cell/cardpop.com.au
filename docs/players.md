# Player pages

One public page per collected athlete — `/players/<slug>` — with a short
profile, the cards worth knowing, Australian-dollar price history where the
tracker covers them, and every card of theirs listed on CardPop. `/players` is
the index, grouped by sport. Sellers tag a card with its player in the card
form, and that tag is what puts the card on the page.

The twenty seeded players are a starting list, not a fixed one: admins add,
edit, hide and reorder players at **Admin → Players** without a deploy.

## Where things live

| Piece | File |
|---|---|
| Schema, RLS, seed, tracker backfill | `supabase/migrations/20261018020526_players.sql` |
| Pure helpers (paths, slugs, matching, text) | `utils/players.js` — dependency-free, shared with `api/prerender.js` |
| Supabase reads + column projections | `lib/players.js` |
| Cached published list (one read per page) | `hooks/usePlayers.js` (`usePlayers()`, `loadPlayers()`, `resetPlayersCache()`) |
| Searchable Player field for the card form | `components/PlayerPicker.jsx` (also exports `PlayerAvatar`) |
| "Player: …" chip on a card's product page | `components/PlayerLinkChip.jsx` |
| Public pages | `pages/players/PlayersIndexPage.jsx`, `pages/players/PlayerPage.jsx` |
| Admin | `pages/admin/PlayersAdminPage.jsx` (`/admin/players`) |
| Bot HTML + sitemap | `renderPlayersIndex()` / `renderPlayer()` in `api/prerender.js`, the `players` section of `api/sitemap.js`, the two `/players` rewrites in `vercel.json` |
| Tests | `tests/frontend/players.test.js`, `tests/frontend/playerPicker.test.jsx`, `tests/backend/vault-item-input.test.js` (player_id), `tests/db/run-players-migration.sh` |

## Data model

`players` — the catalogue.

| Column | Meaning |
|---|---|
| `slug` | URL key, unique, `^[a-z0-9]+(-[a-z0-9]+)*$` (checked by the DB). Changing a published slug breaks shared links; there is no redirect table. |
| `name`, `sport`, `team`, `position`, `nationality`, `born_on`, `born_year`, `career_span` | The facts row. `born_on` is the full date of birth (rendered by `formatBorn()` as "30 December 1984" and emitted as schema.org `birthDate`); `born_year` is for rows where only the year is known and is overwritten from `born_on` by the `trg_players_sync_born_year` trigger whenever a full date is set (`20261018083926_players_born_on_lebron_76ers.sql`). `sport` is the marketplace collection name (`NBA`, `AFL`, `Soccer`, `Formula 1`…) so the page can link to `/collections/<slug>` via `resolveCollectionSlug()`. |
| `headline` | One sentence: cards, search results, `<meta description>`. |
| `bio`, `collecting_notes` | Plain text, paragraphs separated by a blank line (`splitParagraphs()`). No HTML. |
| `key_cards` | `[{ name, note, image_url? }]` — "Cards worth knowing". Must be a JSON array (DB check). `image_url` is optional: an `http(s)` URL or a site-relative path under `public/` (e.g. `/images/players/lebron-james-2003-04-topps-chrome-111.webp`), shown as a thumbnail beside the entry; `keyCardImage()` drops anything else. |
| `aliases` | Nicknames and alternate spellings the picker and site search match (`MJ`, `Wemby`, `Luka Doncic`). |
| `image_url` | Optional. Blank renders the player's initials. Only use a photo CardPop has the rights to. |
| `sort_order`, `is_published` | Display order (lower first) and visibility. Unpublished rows are hidden from everyone but admins. |

RLS: anyone reads published rows (admins see drafts too); insert / update /
delete are admin-only (`profiles.is_admin`). The admin page writes through the
browser client under those policies — there is no server route.

`vault_items.player_id` → `players(id)`, `on delete set null`, partial index.
Set by the Player picker, written through `POST/PUT /vault/items` like every
other column (`src/utils/vaultItemInput.js` accepts only a UUID-shaped value,
so a stray string becomes "no player" rather than a 500). The lock trigger
treats it as an ordinary column: a locked card can't change its player.

`tracked_cards.player_id` → `players(id)`. Ties the daily price snapshots to a
player so the page can chart them. The migration backfills it by matching the
tracker's `"<Player> <Set> Rookie"` names (and aliases, for diacritic-free
spellings). A new tracker card for a seeded player needs its `player_id` set —
there is no admin UI for that yet; do it in a migration.

## How a card gets onto a player page

1. The seller picks the player in the **Player** field on the Details step of
   the card form (sports collections only — it's hidden for Pokémon and the
   other TCGs). The picker matches names, surnames, nicknames and
   diacritic-free spellings in the browser against the cached published list.
   Picking a player fills an empty Card Name with the player's name, and the
   small card under the field links to the player page **in a new tab** so the
   half-finished listing is never abandoned.
2. The card is saved with `player_id`; the marketplace listing is created as
   usual.
3. `fetchPlayerListings()` reads `listings` with the `!inner` vault embed
   filtered on `vault_item.player_id`. Visibility is still the card's own RLS
   (`publicly_listed`), so a vault-only card never shows. Sold listings are
   kept (badged Sold) after the active ones.

Deleting a player keeps the cards and clears the tag (`on delete set null`).
Unpublishing hides the page and keeps everything.

## Search and navigation

* Site search (`pages/SearchResultsPage.jsx`) has a **Players** section at the
  top: `searchPlayers()` matches the cached list with `matchPlayers()`, then
  the shared `rankItems()` ranks it like every other source.
* Header: the **Buy Cards** dropdown and the mobile Browse section end with a
  "Shop by Player" row. Footer → Explore → Players.
* Product page: a card with a `player_id` shows a "Player: Name" chip
  (`PlayerLinkChip`) under the set line. The chip reads the player row itself
  so the product page's listing query is unchanged — if the `players` table is
  unreachable the chip simply doesn't render.

## SEO

Both routes are prerendered for bots (`vercel.json` rewrites → `api/prerender.js`)
with `BreadcrumbList` and `ProfilePage` / `Person` JSON-LD, and listed in the
sitemap. Per `docs/adsense-readiness.md`, `/players` is `noindex, follow` and
left out of the sitemap while it has no published rows. Pages never claim a
number the DB doesn't back: listing counts and prices come from the tables.

Bios state career facts (titles, awards, draft position). Never type a price
into a bio or key-card note — prices come from the tracker and go stale.

## Adding or changing players

* **In the product**: Admin → Players → Add player. Slug derives from the name
  (`playerSlug()`); aliases are comma-separated; key cards are name + note
  rows. Toggle **Published** to hide a page without losing anything.
* **In bulk**: a migration that `insert … on conflict (slug) do nothing`, like
  the seed. Never edit production through the dashboard (see CLAUDE.md →
  Supabase).
* **Renaming a player** keeps the slug unless you change it; a changed slug has
  no redirect, so update any links you've shared.

## Testing

```bash
npx vitest run tests/frontend/players.test.js tests/frontend/playerPicker.test.jsx tests/backend/vault-item-input.test.js
# Migration behaviour (needs a local Postgres 15+):
PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-players-migration.sh
```

The DB script applies the migration twice (re-run must be a no-op) and checks
the seed count, the tracker backfill, RLS for anon / non-admin / admin, the
slug check constraint, `updated_at`, the `vault_items` FK and the unlink on
delete.

## Deploy note

Vercel builds the frontend on merge while GitHub Actions applies the migration
a minute or two later. Until the migration lands, the Player field shows
"Player tagging is unavailable right now", the pages and search section stay
empty, and saving a card still works — nothing selects `player_id` in a shared
grid projection, by design. Confirm the **Supabase migrations** run is green
after merging.
