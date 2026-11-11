-- Collect-It Con organiser page: write its public profile, and add the two
-- shows it has already run so they appear under "Past events" on
-- /events/organisers/collect-it-con.
--
-- An organiser page lists every event whose organizer_name names the organiser
-- (pages/community/EventOrganiserPage.jsx), so "linking" a past event is
-- setting organizer_name = 'Collect-It Con'. The Trading Cards Edition
-- (14 Nov 2026) already uses that name (20261028054422).
--
-- Past events are stored as status `completed`: they keep a public page and sit
-- in the Past tab (20261017044544_past_events_and_attendee_reviews.sql).
-- Details are from the organiser's Eventbrite page (dates, venues, "from"
-- prices) and the event posters (times). Idempotent: the organiser profile only
-- fills blanks, and each event insert is skipped if its slug exists.

-- ── Organiser profile ────────────────────────────────────────────────────────
insert into public.event_organisers (name, description, website_url, facebook_url)
values (
  'Collect-It Con',
  E'Collect-It Con is a grassroots Melbourne convention for trading cards, sports memorabilia and collectibles. It is run by collectors, for collectors: a welcoming room where you can trade, sell, hunt for grails and meet people who care about the same things you do.\n\n'
  || E'The shows started in Collingwood in late 2025, moved to Box Hill Town Hall for a sold-out run in May 2026, and the Trading Cards Edition lands in Glen Waverley in November 2026. Each one brings together local vendors, hobbyists and first-timers, with plenty of TCG, sports cards and one-off finds on the tables.\n\n'
  || E'Follow Collect-It Con for announcements on vendor tables, tickets and the next date, and check the events below for what is on now and what has already run.',
  'https://collectitcon.com.au',
  'https://www.facebook.com/share/1Pi9wbtDMB/'
)
on conflict (lower(btrim(name))) do update set
  description  = coalesce(nullif(btrim(public.event_organisers.description), ''), excluded.description),
  website_url  = coalesce(nullif(btrim(public.event_organisers.website_url), ''), excluded.website_url),
  facebook_url = coalesce(nullif(btrim(public.event_organisers.facebook_url), ''), excluded.facebook_url);

-- ── Past events ──────────────────────────────────────────────────────────────
insert into public.events (
  event_type, status,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time,
  is_free, entry_fee_aud,
  website_url, organizer_name,
  tags
)
select
  'card_show'::event_type, 'completed'::event_status,
  'Collect-it Con 2026',
  'collect-it-con-2026-05-16',
  'Collect-It Con at Box Hill Town Hall: a one-day Melbourne convention for trading cards, sports memorabilia and collectibles.',
  E'Collect-It Con 2026 filled Box Hill Town Hall on Saturday 16 May 2026 with local vendors, collectors and hobbyists. It was a one-day convention built around trading cards, sports memorabilia and collectibles, from 10:00am to 4:00pm.\n\n'
  || E'The day was about buying, selling, trading and talking cards in a relaxed, community-run room. Tickets sold out through Eventbrite.\n\n'
  || E'This event has finished. See the organiser page for what Collect-It Con is running next.',
  'Box Hill Town Hall', '1022 Whitehorse Rd', 'Box Hill', 'VIC', '3128',
  '2026-05-16'::date, '2026-05-16'::date, '10:00'::time, '16:00'::time,
  false, 16.62,
  'https://collectitcon.com.au', 'Collect-It Con',
  array['Card Show','Trading Cards','Sports Cards','TCG','Collectibles','Melbourne','Box Hill','Victoria']::text[]
where not exists (select 1 from public.events where slug = 'collect-it-con-2026-05-16');

insert into public.events (
  event_type, status,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time,
  is_free, entry_fee_aud,
  website_url, organizer_name,
  tags
)
select
  'card_show'::event_type, 'completed'::event_status,
  'Collect-it Con',
  'collect-it-con-2025-11-30',
  'The first Collect-It Con, at Collingwood Town Hall: a one-day Melbourne convention for trading cards, sports memorabilia and collectibles.',
  E'The first Collect-It Con took over Collingwood Town Hall on Sunday 30 November 2025, from 10:00am to 5:00pm. It brought Melbourne''s trading card, sports memorabilia and collectibles community into one room to trade, sell and discover new and old treasures.\n\n'
  || E'Tickets were sold through Eventbrite.\n\n'
  || E'This event has finished. See the organiser page for what Collect-It Con is running next.',
  'Collingwood Town Hall', '140 Hoddle St', 'Abbotsford', 'VIC', '3067',
  '2025-11-30'::date, '2025-11-30'::date, '10:00'::time, '17:00'::time,
  false, 12,
  'https://collectitcon.com.au', 'Collect-It Con',
  array['Card Show','Trading Cards','Sports Cards','TCG','Collectibles','Melbourne','Collingwood','Victoria']::text[]
where not exists (select 1 from public.events where slug = 'collect-it-con-2025-11-30');
