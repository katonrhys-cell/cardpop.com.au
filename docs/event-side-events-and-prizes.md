# Event side events & prizes

A card show is rarely one tournament. Flesh and Blood's *The Calling: Sydney*
is a Friday of side events, a Saturday main event, a Sunday showdown and a
prize table. Organisers (and admins) can publish both on the event page.

- **Side Events & Schedule** — each tournament or extra with its day, time,
  entry fee, player cap, details and an optional registration link, shown
  day by day in time order, straight after "About This Event".
- **Prizes** — a headline prize pool and one row per placing with its
  payout and **photos of the cards that can be won**, shown below the photo
  albums and **above the event videos**.

## Where it lives

| Piece | Location |
|---|---|
| Columns | `events.side_events` (jsonb array), `events.event_prizes` (jsonb array), `events.prize_pool` (text, ≤ 200 chars). Migration `20261111092216_event_side_events_and_prizes.sql` — adds them, recreates `events_public` with the three appended, and redefines `event_logged_fields()` so live organiser edits are logged |
| Side event shape | `utils/eventSideEvents.js` — `[{ title, date, start_time, end_time, entry_fee_aud, player_cap, description, url }]`. `cleanSideEvents()` is the one normaliser: no title = dropped, an impossible date / time / fee / cap is blanked, only http(s) links survive, 40 max. `entry_fee_aud` `0` = free, `null` = not stated. `groupSideEventsByDay()` sorts by day then start time (undated / untimed last). `buildSubEventLds()` turns dated side events into schema.org `subEvent`s |
| Prize shape | `utils/eventPrizes.js` — `[{ place, reward, images: [url] }]`, 24 prizes × 6 photos. A prize needs a place or reward (a photo alone isn't one); `cleanPrizePool()` trims the headline total |
| Form | The event form's **Side Events & Prizes** tab (`components/events/EventSideEventsEditor.jsx`, `EventPrizesEditor.jsx`). Same form for admins and organisers; new side-event rows start on the previous row's day (else the event's start date). Validation (`sideEventsFormError`) runs before saving and sends the organiser to that tab |
| Prize photos | Picked files upload on save through `utils/uploadEventImage.js` into `events/prizes/` (compressed, immutable timestamped path, 480 px thumb companion — never upload to the `events` bucket any other way), exactly like gallery photos; uploaded ones become saved ones so a retry doesn't upload twice |
| Page | `components/events/EventSideEvents.jsx` and `EventPrizes.jsx`, rendered by `EventDetailCard`. Order: About → Side Events → Photos → **Prizes** → Videos. Prize photos are card-shaped tiles that open full size. The Register link is hidden once the event is over |
| SEO | Event JSON-LD gets `subEvent` entries (`lib/eventSeo.js` and `api/prerender.js`, both via `buildSubEventLds`). The prerender renders the schedule and the prize table — photos as `<figure>`s — as plain HTML for bots. It reads the three columns in a **separate best-effort query**, so an event page still renders if the migration hasn't landed |
| Change log | `side_events`, `event_prizes`, `prize_pool` are in `EVENT_LOGGED_FIELDS` / `event_logged_fields()` (kept equal by a test), labelled "Side events" / "Prizes" / "Total prize pool" |

## Rules

- The page reads `events_public` with `select('*')`, so the columns reach it
  automatically; **don't add them to `EVENT_CARD_COLUMNS`** — grids and rails
  must stay lean, and a select naming an unmigrated column would break every
  event list.
- The columns are ordinary organiser-editable fields (`guard_event_organiser_write`
  doesn't pin them): once an event is live, an organiser's edit goes live
  straight away and is logged for the admins like any other field.
- Never put a price you can't back into a prize — it's the organiser's
  published payout, not CardPop's claim.
- Add a column to `events_public` only by appending it in a migration that
  recreates the view — `create or replace view` can't drop or reorder.
