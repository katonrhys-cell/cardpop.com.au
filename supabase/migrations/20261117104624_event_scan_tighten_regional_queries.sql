-- Tighten the event scanner's regional searches (docs/event-scanning.md).
--
-- The searches added in 20261117063127 named towns and the bare words "card
-- show" / "trade" / "regional". On their first run (2026-11-17) they returned
-- hardware "trade" stores, agricultural "show" holiday calendars and regional
-- business directories alongside the card shows. Each is rewritten around a
-- quoted phrase that only a card event page uses, with the game or hobby named.
--
-- Rows are updated in place (matched on their old wording) so their rotation
-- state is kept; a row an admin has already reworded or removed is left alone.

update public.event_scan_sources s
set value = v.new_value, updated_at = now()
from (values
  ('card show Adelaide South Australia Pokemon sports cards next date',
   '"card show" Adelaide Pokemon OR "sports cards" OR TCG upcoming tickets'),
  ('collectables fair Adelaide Hills Mount Gambier Whyalla trading cards',
   '"trading cards" "collectables fair" OR "card show" Mount Gambier OR Whyalla OR "Adelaide Hills"'),
  ('card show Canberra ACT Pokemon sports cards next date tickets',
   '"card show" Canberra Pokemon OR "sports cards" OR TCG upcoming tickets'),
  ('trading card show Townsville Cairns Mackay Rockhampton dates',
   '"card show" OR "trading card expo" Pokemon OR TCG Townsville OR Cairns OR Mackay OR Rockhampton'),
  ('card show Toowoomba Ipswich Sunshine Coast trading cards event',
   '"card show" OR "card fair" Pokemon OR TCG Toowoomba OR Ipswich OR "Sunshine Coast"'),
  ('trading card show Bunbury Mandurah Geraldton regional WA',
   '"card show" OR "card fair" Pokemon OR TCG Bunbury OR Mandurah OR Geraldton'),
  ('card show Bendigo Shepparton Gippsland trading cards event dates',
   '"card show" OR "card fair" Pokemon OR TCG Bendigo OR Shepparton OR Gippsland'),
  ('card show Central Coast Coffs Harbour Port Macquarie trading cards',
   '"card show" OR "card fair" Pokemon OR TCG "Central Coast" OR "Coffs Harbour" OR "Port Macquarie"'),
  ('toy and hobby fair Australia trading cards collectables upcoming',
   '"toy and hobby fair" OR "toy fair" Australia "trading cards" upcoming dates'),
  ('sports card trade night Australia NBA AFL breakers event',
   '"sports card" "trade night" Australia NBA OR AFL OR NRL upcoming'),
  ('Pokemon trade night Sydney Brisbane Perth Adelaide upcoming',
   '"Pokemon" "trade night" Sydney OR Brisbane OR Perth OR Adelaide upcoming'),
  ('comic con pop culture expo Australia trading card vendors 2027 dates',
   '"pop culture expo" OR "comic con" Australia 2027 "trading cards" dates tickets')
) as v(old_value, new_value)
where s.kind = 'search_query'
  and s.value = v.old_value
  and not exists (
    select 1 from public.event_scan_sources x
    where x.kind = 'search_query' and x.value = v.new_value
  );
