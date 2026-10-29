# Giveaways

An Instagram-led promotion whose **entries and draw live on the site**. The post
asks people to follow, comment the surname of the card they want, then register
on CardPop and lock in their entry at `/giveaway`. Instagram can't check
residency, can't stop duplicate entries and can't prove a draw was random; the
site can.

## Pieces

| Piece | Where |
|---|---|
| Tables `giveaways`, `giveaway_entries` + entry trigger + RLS | `supabase/migrations/20261029203631_giveaways.sql` |
| Shared helpers (phase, handle/postcode checks, prize cleaning, tallies) | `utils/giveaway.js` (dependency-free, imported by the SPA and `src/`) |
| Public read + member entry; admin CRUD, entries, CSV, draw | `src/routes/giveaways.js` (`/giveaways/*`, admin under `/giveaways/admin/*`) |
| Draw + CSV logic | `src/services/giveawayService.js` |
| Public page `/giveaway` (current) and `/giveaways/:slug` | `pages/community/GiveawayPage.jsx` |
| Admin → Giveaways `/admin/giveaways` | `pages/admin/GiveawaysAdminPage.jsx` |
| Winner email | `giveawayWinnerEmail` in `src/emails/templates.js` → `sendGiveawayWinner()` |
| Winner bell | `notifications.type = 'giveaway_won'` |

## Lifecycle

`draft` → `open` → (closing time passes) → `drawn`. `closed` and `cancelled`
exist for an admin to stop early or pull a promotion.

`status` is the admin's switch; the **window** (`opens_at` / `closes_at`) decides
what an `open` giveaway shows. `giveawayPhase()` turns both into one of
`hidden | upcoming | open | closed | drawn` and is used by the page, the admin
list and the route guards. The DB trigger refuses an entry outside the window
whatever the page says.

## Entry rules (the trigger owns them)

`giveaway_entries_before_insert()`:

- giveaway is `open` and now is inside the window;
- the member's `auth.users.email_confirmed_at` is set ("register on CardPop" means a confirmed account);
- the residency and age ticks are true;
- the Instagram handle is normalised (trim, strip `@`, lower-case) and must match `^[a-z0-9._]{1,30}$`;
- in `pick_prize` mode the `prize_key` must be one of the giveaway's `prizes[].key`;
- `verified_*` are forced null.

Plus two unique constraints: one entry per member, and one per Instagram handle
per giveaway (one Instagram account can't enter through several CardPop accounts).

The route (`POST /giveaways/:slug/enter`) writes through a **caller-scoped**
client so RLS and the trigger stay the enforcement point; it only adds the
honeypot field, the newsletter opt-in (best-effort Kit subscribe) and the
friendly error mapping. Members can read their own entry; there is no client
UPDATE/DELETE (withdrawals go through support).

## The draw

`POST /giveaways/admin/:id/draw` (`requireAdmin`: auth + admin + MFA):

- only once the phase is `closed` (closing time passed, not yet drawn);
- pool is `verified` (entries an admin ticked after finding the comment) or `all`;
- the eligible entries are sorted by `created_at, id`, and
  `crypto.randomInt(0, n)` picks the index;
- the update is conditional on `status <> 'drawn'`, so two admins clicking at
  once can't produce two winners;
- the giveaway stores `winner_entry_id`, `drawn_at`, `drawn_by` and
  `draw_record = { pool, count, index, nonce, drawn_at }` — the record to show if
  anyone asks how the winner was picked;
- the winner is emailed (`sendGiveawayWinner`, 7 days to claim) and belled.

The public page shows the winner as `@handle` and the card they named; never a
name, email or location.

## Australian trade promotion rules

A random draw is a trade promotion lottery. Permits are required only above a
total prize value: NSW $10,000, SA $5,000, ACT $3,000, NT $5,000 (NT-based
promoters). A card worth under $30 is well under every threshold, so no permit
is needed. The conditions that still apply, and that this feature is built
around:

- publish the terms before entry opens (the admin form seeds a full set; the
  page shows them verbatim);
- entry must be free — a free account is fine, a purchase can't be required;
- draw at or after the published close, record the draw, notify the winner in
  writing (the email) within a couple of days;
- say how the winner is chosen ("drawn at random from all eligible entries").

Instagram's promotion guidelines: keep the "not sponsored, endorsed or
administered by Instagram" line in the caption and terms; don't require tagging
people in photos they aren't in; don't make a story share a condition of entry.

## Running one

1. Admin → Giveaways → **New giveaway**. Title, slug, description, hero image,
   the Instagram post URL (once it's up), prizes (name, detail, image), the
   window, terms. Leave `status = draft` until the post is live, then set `open`.
2. Post on Instagram with the link `cardpop.com.au/giveaway`.
3. As entries come in, open **Entries**, find each handle's comment under the
   post and tick it. Export the CSV any time.
4. After the closing time, **Draw winner** (verified pool unless you skipped
   verification). The winner is emailed and belled; announce them in stories.
5. Post the card. The page keeps showing the result.

## Tests

- `tests/backend/giveaways.test.js` — route guards, entry error mapping, draw.
- `tests/frontend/giveaway.test.js` — the shared helpers.
