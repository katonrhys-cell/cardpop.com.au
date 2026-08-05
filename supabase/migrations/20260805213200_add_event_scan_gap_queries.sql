-- Widen the nightly event scan to cover the gaps a manual sweep on 5 Aug 2026
-- found, and to keep watching the recurring series whose next dates weren't
-- published yet.
--
-- The sweep behind this turned up three kinds of hole in the current source
-- list, and each gets queries here:
--
--   1. 2027 is nearly empty. Australian organisers announce three to six months
--      out, so as of Aug 2026 the calendar realistically only reaches into
--      early 2027. These queries need to keep running to catch the rest as it
--      lands, rather than being a one-off research task.
--   2. Tasmania and the Northern Territory returned *nothing* across repeated
--      searching from several angles. That may be genuine (both look like
--      LGS-only markets) but "not found" is not "does not exist", so they stay
--      on the rotation.
--   3. Recurring series with a known cadence but no published next date —
--      Hunters Card Show, Perth Card Fest, Collector Con, Trading Card Summit.
--      Naming the series directly beats a generic city query.
--
-- Athlete card-signing sessions are added too: that whole category was
-- essentially uncovered by the existing sources.
--
-- Priorities follow the existing convention: 10 = national/high-yield,
-- 20 = big three markets, 30 = smaller states, 40 = game-specific.
--
-- NOTE ON SEED URLS — deliberately not added here.
-- `event_scan_sources.kind` also allows 'seed_url', and the obvious move would
-- have been to add the aggregator calendars this sweep leaned on
-- (tcgcalendar.com.au, banktcg.com/trade-shows, phoenyxcurios.com.au and
-- friends). Two things in the engine make that ineffective today:
--   * `registerCandidates()` returns only URLs it has never seen, and seed URLs
--     go through it like any other candidate — so a seed page is fetched once,
--     ever, and silently skipped on every later run. Listing pages are exactly
--     the case that needs re-reading.
--   * `extractEventFromPage()` extracts a single event per page, so a calendar
--     listing twenty shows yields at most one of them.
-- Together those mean a seed URL on an aggregator would import one event and
-- then go dormant. Making seed URLs work as `docs/event-scanning.md` describes
-- needs both an exemption from the dedupe ledger and multi-event extraction —
-- a real change to the engine, not a data change, so it is left for a decision
-- rather than smuggled in here.
--
-- Idempotent via the (kind, value) unique constraint.

insert into public.event_scan_sources (kind, value, state, label, priority)
values
  -- ── 2027 and beyond ────────────────────────────────────────────────────────
  ('search_query', 'trading card show Australia 2027 dates announced tickets',        null,  '2027 season dates',        10),
  ('search_query', 'card expo Australia 2027 tickets on sale collectables festival',  null,  '2027 expos',               10),

  -- ── Recurring series with an unpublished next date ─────────────────────────
  ('search_query', 'Hunters Card Show Eight Mile Plains Brisbane dates tickets',      'QLD', 'Hunters Card Show',        20),
  ('search_query', 'Perth Card Fest PCF Claremont Showground next show date',         'WA',  'Perth Card Fest',          20),
  ('search_query', 'Collector Con Penrith Campbelltown Newcastle next dates',         'NSW', 'Collector Con dates',      20),
  ('search_query', 'Trading Card Summit Sydney Showground 2027 dates tickets',        'NSW', 'Trading Card Summit',      20),
  ('search_query', 'CollectFest Perth Brisbane Melbourne Sydney 2027 dates',          null,  'CollectFest national run', 20),

  -- ── States the sweep could not find anything in ────────────────────────────
  ('search_query', 'card show Launceston Devonport Tasmania trading cards dates',     'TAS', 'Regional Tasmania',        30),
  ('search_query', 'Pokemon trading card event Darwin Alice Springs NT dates',        'NT',  'NT card events',           30),
  ('search_query', 'card show Wagga Albury Bathurst Tamworth regional NSW dates',     'NSW', 'Regional NSW towns',       30),
  ('search_query', 'trading card expo Gold Coast Sunshine Coast Townsville Cairns',   'QLD', 'Regional QLD',             30),

  -- ── Categories with no coverage at all ─────────────────────────────────────
  ('search_query', 'sports card signing session Australia NRL AFL athlete tickets',   null,  'Athlete signings',         40),
  ('search_query', 'Pokemon regional championships Australia 2027 dates RK9',         null,  'Play! Pokemon 2027',       40),
  ('search_query', 'ANZ MTG Super Series regional championship Australia dates',      null,  'ANZ MTG Super Series',     40),
  ('search_query', 'One Piece Gundam Union Arena regional Australia 2027 dates',      null,  'Bandai Oceania 2027',      40),
  ('search_query', 'Star Wars Unlimited Digimon championship Australia 2027 dates',   null,  'SWU / Digimon 2027',       40)
on conflict (kind, value) do nothing;
