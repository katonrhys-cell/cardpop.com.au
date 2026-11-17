-- More event coverage for the scanner (docs/event-scanning.md).
--
-- 1. Listing pages. A `seed_url` used to be read once and yield one event; it
--    is now re-read weekly by the daily backlog run and every upcoming event on
--    it becomes a draft. These are the Australian calendars and organiser
--    "upcoming shows" pages the weekly search kept finding and never reading.
-- 2. Wider searches, aimed at where the calendar is thin (SA, ACT, NT, regional
--    QLD and WA) and at the ticketing sites most shows sell through.
--
-- Day-to-day edits belong in Admin → Event Management → Automated Event Scan;
-- this is a one-off top-up. Existing rows are left alone.

insert into public.event_scan_sources (kind, value, state, label, priority) values
  ('seed_url', 'https://collectorcon.com.au/collector-con-events',        'NSW', 'Collector Con — events',             20),
  ('seed_url', 'https://perthcardfest.org/',                               'WA',  'Perth Card Fest',                    20),
  ('seed_url', 'https://collectfest.com.au/',                              null,  'CollectFest',                        20),
  ('seed_url', 'https://treasurecon.com.au/events',                        null,  'TreasureCon — events',               20),
  ('seed_url', 'https://tassietradeshow.com.au/',                          'TAS', 'Tassie Trade Show',                  20),
  ('seed_url', 'https://anzmtg.com.au/regional-championships',             null,  'ANZ MTG — regional championships',   30),
  ('seed_url', 'https://banktcg.com/trade-shows/australia/sydney',         'NSW', 'Bank TCG trade shows — Sydney',      30),
  ('seed_url', 'https://banktcg.com/trade-shows/australia/brisbane',       'QLD', 'Bank TCG trade shows — Brisbane',    30),
  ('seed_url', 'https://banktcg.com/trade-shows/australia/canberra',       'ACT', 'Bank TCG trade shows — Canberra',    30),
  ('seed_url', 'https://cardshowsaustralia.com/',                          null,  'Card Shows Australia — calendar',    40),
  ('seed_url', 'https://cardpulse.club/card-shows',                        null,  'CardPulse — card shows',             40),
  ('seed_url', 'https://cardwatch.com.au/events',                          null,  'CardWatch — events',                 40),
  ('seed_url', 'https://tcgstorefinder.com.au/events',                     null,  'TCG Store Finder — events',          40),
  ('seed_url', 'https://ozcardtrader.com.au/forums/card-shows.74',         null,  'OzCardTrader — card shows forum',    50)
on conflict (kind, value) do nothing;

insert into public.event_scan_sources (kind, value, state, priority) values
  ('search_query', 'Humanitix trading card show Australia tickets',                          null,  60),
  ('search_query', 'TryBooking card fair collectables swap meet Australia',                  null,  60),
  ('search_query', 'Eventbrite Pokemon card show trade day Australia',                       null,  60),
  ('search_query', 'card show Adelaide South Australia Pokemon sports cards next date',      'SA',  70),
  ('search_query', 'collectables fair Adelaide Hills Mount Gambier Whyalla trading cards',   'SA',  90),
  ('search_query', 'card show Canberra ACT Pokemon sports cards next date tickets',          'ACT', 70),
  ('search_query', 'trading card show Townsville Cairns Mackay Rockhampton dates',           'QLD', 90),
  ('search_query', 'card show Toowoomba Ipswich Sunshine Coast trading cards event',         'QLD', 90),
  ('search_query', 'trading card show Bunbury Mandurah Geraldton regional WA',               'WA',  90),
  ('search_query', 'card show Bendigo Shepparton Gippsland trading cards event dates',       'VIC', 90),
  ('search_query', 'card show Central Coast Coffs Harbour Port Macquarie trading cards',     'NSW', 90),
  ('search_query', 'toy and hobby fair Australia trading cards collectables upcoming',       null,  80),
  ('search_query', 'Pokemon trade night Sydney Brisbane Perth Adelaide upcoming',            null,  80),
  ('search_query', 'sports card trade night Australia NBA AFL breakers event',               null,  80),
  ('search_query', 'comic con pop culture expo Australia trading card vendors 2027 dates',   null,  90)
on conflict (kind, value) do nothing;
