-- Starter search queries for the nightly event scan.
--
-- Without active sources the cron has nothing to search for, so this seeds a
-- spread across the capital cities and the games CardPop actually covers. The
-- run budget only takes the top few by priority each night and rotates on
-- last_scanned_at, so a long list here costs nothing extra per run — it just
-- widens the rotation.
--
-- Priorities: 10 = national/high-yield catch-alls, 20 = the big three markets
-- (NSW/VIC/QLD), 30 = the smaller states, 40 = game-specific.
--
-- Idempotent via the (kind, value) unique constraint. Editing or disabling a
-- query later is a normal update through the admin API, not a migration.

insert into public.event_scan_sources (kind, value, state, label, priority)
values
  ('search_query', 'trading card show Australia upcoming dates',                 null,  'National card shows',        10),
  ('search_query', 'Pokemon TCG event Australia upcoming tournament',            null,  'National Pokemon events',    10),
  ('search_query', 'card fair Australia collectibles expo tickets',              null,  'National card fairs',        10),

  ('search_query', 'Pokemon card show Sydney NSW upcoming',                      'NSW', 'Sydney Pokemon',             20),
  ('search_query', 'trading card fair Sydney NSW dates tickets',                 'NSW', 'Sydney card fairs',          20),
  ('search_query', 'card show Melbourne VIC trading cards upcoming',             'VIC', 'Melbourne card shows',       20),
  ('search_query', 'Pokemon trade night Melbourne VIC event',                    'VIC', 'Melbourne trade nights',     20),
  ('search_query', 'trading card expo Brisbane QLD upcoming dates',              'QLD', 'Brisbane card expos',        20),
  ('search_query', 'Gold Coast card show collectibles fair QLD',                 'QLD', 'Gold Coast card shows',      20),

  ('search_query', 'trading card show Perth WA upcoming event',                  'WA',  'Perth card shows',           30),
  ('search_query', 'card fair Adelaide SA trading cards event',                  'SA',  'Adelaide card fairs',        30),
  ('search_query', 'trading card event Canberra ACT upcoming',                   'ACT', 'Canberra events',            30),
  ('search_query', 'card show Hobart Tasmania collectibles event',               'TAS', 'Hobart events',              30),
  ('search_query', 'trading card event Darwin NT upcoming',                      'NT',  'Darwin events',              30),
  ('search_query', 'trading card show Newcastle Wollongong NSW upcoming',        'NSW', 'Regional NSW',               30),
  ('search_query', 'card fair Geelong Ballarat regional Victoria event',         'VIC', 'Regional VIC',               30),

  ('search_query', 'One Piece card game regional Australia tournament dates',    null,  'One Piece regionals',        40),
  ('search_query', 'Magic the Gathering prerelease Australia local game store',  null,  'MTG prereleases',            40),
  ('search_query', 'Yu-Gi-Oh regional qualifier Australia upcoming',             null,  'Yu-Gi-Oh regionals',         40),
  ('search_query', 'Lorcana Flesh and Blood tournament Australia dates',         null,  'Lorcana / FaB',              40),
  ('search_query', 'sports card show Australia AFL NRL NBA cards event',         null,  'Sports card shows',          40)
on conflict (kind, value) do nothing;
