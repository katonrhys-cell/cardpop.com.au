-- Seed three 2026 card shows onto the /events calendar, sourced from the
-- Matts Cardcase 2026 show-schedule announcement (Instagram @mattscardcase /
-- @mattscardshop) and cross-checked against organiser listings where available:
--
--   1. Melbourne Card Fair — AAL, Thornbury (Melbourne), VIC — Sun 2 Aug 2026
--      (details confirmed via the organiser's TryBooking page: 10:30am–3:30pm,
--      $10 online / $15 at the door)
--   2. Collector's Paradise — Oakleigh Stadium (Melbourne), VIC — Sat 3 Oct 2026
--      (touring series, collectorsparadise.au; session times/entry not yet published)
--   3. The Ultimate Sports Collectors Convention — Seaworks Maritime Precinct,
--      Williamstown (Melbourne), VIC — Sun 6 Dec 2026 (times/entry not yet published)
--
-- The five other shows on the same flyer (CardCon Melbourne, Oz National,
-- SA Card Show, Collectorama Keilor, Trading Card Summit) are already seeded.
--
-- All three land 'approved' so they're live on the calendar immediately. Each
-- insert is idempotent: re-running skips the row if an event with the same slug
-- already exists. Details that couldn't be confirmed (entry pricing and times
-- for shows 2 and 3) are left to the organiser links and noted in the
-- descriptions rather than invented.

-- ── 1. Melbourne Card Fair — Thornbury ─────────────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, entry_fee_aud, registration_required,
  ticket_url, organizer_name,
  tags, seo_title, seo_description
)
select
  'card_show'::event_type,
  'approved'::event_status,
  'Melbourne Card Fair – Thornbury',
  'melbourne-card-fair-thornbury-2026-08-02',
  'All kinds of trading cards and sporting collectables across two rooms in Thornbury — AFL, Pokémon, NBA and everything in between.',
  E'The Melbourne Card Fair returns to AAL in Thornbury on Sunday 2 August 2026, 10:30am – 3:30pm.\n\nTwo rooms of dealers buying, selling and trading all kinds of trading cards and sporting collectables — AFL, Pokémon, NBA and everything in between — with lots of new dealers locked in.\n\nEntry is $10 online via TryBooking or $15 at the door. The venue is a 2-minute walk from Thornbury Station.',
  'AAL',
  '2 Watt Street',
  'Thornbury',
  'VIC',
  '3071',
  '2026-08-02'::date,
  '10:30'::time,
  '15:30'::time,
  false,
  10,
  false,
  'https://www.trybooking.com/events/landing/1596300',
  'Melbourne Card Fair',
  array['Card Show','Trading Cards','AFL','Pokemon','NBA','Sports Cards','Melbourne','Thornbury']::text[],
  'Melbourne Card Fair 2026 — Thornbury Trading Card Show',
  'The Melbourne Card Fair hits AAL Thornbury on Sunday 2 August 2026, 10:30am–3:30pm. Two rooms of trading cards and sporting collectables — AFL, Pokémon, NBA and more. $10 online, $15 at the door.'
where not exists (
  select 1 from public.events where slug = 'melbourne-card-fair-thornbury-2026-08-02'
);

-- ── 2. Collector's Paradise — Oakleigh Stadium ─────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, suburb, state, postcode,
  start_date, is_free, registration_required,
  website_url, organizer_name,
  tags, seo_title, seo_description
)
select
  'card_show'::event_type,
  'approved'::event_status,
  'Collector''s Paradise – Oakleigh',
  'collectors-paradise-oakleigh-2026-10-03',
  'The touring Pokémon TCG, Yu-Gi-Oh!, One Piece and sports card show lands at Oakleigh Stadium — buy, sell and trade with vendors from across Melbourne.',
  E'Collector''s Paradise comes to Oakleigh Stadium on Saturday 3 October 2026.\n\nBuy, sell and trade rare cards with vendors across Pokémon, Yu-Gi-Oh!, One Piece, sports cards and more at one of Melbourne''s biggest touring trading-card events.\n\nSession times and entry pricing are confirmed closer to the date — check collectorsparadise.au for tickets and the latest details before you head down.',
  'Oakleigh Stadium',
  'Oakleigh',
  'VIC',
  '3166',
  '2026-10-03'::date,
  false,
  false,
  'https://www.collectorsparadise.au',
  'Collector''s Paradise',
  array['Card Show','Trading Cards','Pokemon','Yu-Gi-Oh!','One Piece','Sports Cards','Melbourne','Oakleigh']::text[],
  'Collector''s Paradise Oakleigh 2026 — Melbourne Trading Card Show',
  'Collector''s Paradise hits Oakleigh Stadium on Saturday 3 October 2026 — buy, sell and trade Pokémon, Yu-Gi-Oh!, One Piece and sports cards with vendors from across Melbourne.'
where not exists (
  select 1 from public.events where slug = 'collectors-paradise-oakleigh-2026-10-03'
);

-- ── 3. The Ultimate Sports Collectors Convention — Seaworks, Williamstown ──────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, is_free, registration_required,
  organizer_name,
  tags, seo_title, seo_description
)
select
  'card_show'::event_type,
  'approved'::event_status,
  'The Ultimate Sports Collectors Convention',
  'ultimate-sports-collectors-convention-2026-12-06',
  'Sports cards and memorabilia take over the historic Seaworks Maritime Precinct on Williamstown''s waterfront to close out the 2026 show season.',
  E'The Ultimate Sports Collectors Convention lands at the Seaworks Maritime Precinct on Williamstown''s waterfront on Sunday 6 December 2026.\n\nExpect dealers buying, selling and trading sports cards, graded slabs and sporting memorabilia to round out the 2026 Melbourne show calendar.\n\nSession times and entry pricing are confirmed closer to the date — keep an eye on the organiser''s announcements for tickets and the latest details.',
  'Seaworks Maritime Precinct',
  '82 Nelson Place',
  'Williamstown',
  'VIC',
  '3016',
  '2026-12-06'::date,
  false,
  false,
  'The Ultimate Sports Collectors Convention',
  array['Card Show','Sports Cards','Memorabilia','Trading Cards','Melbourne','Williamstown']::text[],
  'Ultimate Sports Collectors Convention 2026 — Williamstown',
  'The Ultimate Sports Collectors Convention comes to Seaworks Maritime Precinct, Williamstown on Sunday 6 December 2026 — sports cards, slabs and memorabilia on Melbourne''s waterfront.'
where not exists (
  select 1 from public.events where slug = 'ultimate-sports-collectors-convention-2026-12-06'
);
