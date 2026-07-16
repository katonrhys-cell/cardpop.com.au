-- Seed ten 2026 events onto the /events calendar. Every event in this batch was
-- validated against a live ticketing or official registration listing before
-- inclusion:
--
--   Card shows / TCG events:
--   1.  Cardcore Vol. 5 — Welcome to Thornbury, Northcote VIC — Sun 19 Jul 2026 (Oztix)
--   2.  Cardcore Sleepover — Seaworks, Williamstown VIC — Sat 12 – Sun 13 Sep 2026 (Oztix)
--   3.  Newy Card Show — Newcastle Racecourse, Broadmeadow NSW — Sun 27 Sep 2026 (TryBooking)
--   4.  Outwest Card Show — Dubbo RSL, Dubbo NSW — Sat 3 Oct 2026 (123tix)
--   5.  Brisbane Card Show — Distillery Road Market, Eagleby QLD — Sat 28 – Sun 29 Nov 2026 (TryBooking)
--
--   Pop-culture conventions with major trading-card presence:
--   6.  Oz Comic-Con Canberra — EPIC, Mitchell ACT — Sat 15 – Sun 16 Aug 2026 (ozcomiccon.com)
--   7.  Oz Comic-Con Sydney — Sydney Showground, Sydney Olympic Park NSW — Sat 12 – Sun 13 Sep 2026
--   8.  Oz Comic-Con Brisbane — BCEC, South Brisbane QLD — Sat 19 – Sun 20 Sep 2026
--   9.  Supanova Adelaide — Adelaide Showground, Wayville SA — Fri 30 Oct – Sun 1 Nov 2026
--   10. Supanova Brisbane — BCEC, South Brisbane QLD — Fri 6 – Sun 8 Nov 2026
--       (Supanova ticket sales open 21 Jul 2026 via supanova.com.au — noted in descriptions)
--
-- Candidates researched but deliberately NOT seeded (no live ticketing to
-- validate against): Big Boyz Card Show St Marys (18 Oct — no listing yet),
-- Hunters Card Show (no future listing), APCS at Nissan Arena (free entry, no
-- bookings, conflicting dates), Perth Card Fest (next show unannounced),
-- Card Quest Melbourne (no date announced).
--
-- All rows land 'approved' so they're live immediately. Each insert is
-- idempotent: re-running skips the row if an event with the same slug exists.
-- Unconfirmed details (e.g. exact pricing for the conventions) are deferred to
-- the ticketing links rather than invented.

-- ── 1. Cardcore Vol. 5 — Welcome to Thornbury ──────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, registration_required,
  ticket_url, organizer_name,
  tags, seo_title, seo_description
)
select
  'card_show'::event_type,
  'approved'::event_status,
  'Cardcore Vol. 5',
  'cardcore-vol-5-2026-07-19',
  'A TCG takeover of Welcome to Thornbury — curated vendors, food trucks, arcade and backyard-party energy. First 100 through the door get a lucky dip.',
  E'Welcome to [CARDCORE] Vol. 5 takes over Welcome to Thornbury on Sunday 19 July 2026, 11am – 6pm.\n\nThe monthly Sunday session for TCG lovers to gather, trade, collect and connect — curated vendors, rotating food trucks, a fully packed arcade and zero-pressure backyard-party energy.\n\nThe first 100 people through the door get a shot at the lucky dip, with prizes from [CARDCORE] and Welcome to Thornbury. Tickets via Oztix.',
  'Welcome to Thornbury',
  '520 High Street',
  'Northcote',
  'VIC',
  '3070',
  '2026-07-19'::date,
  '11:00'::time,
  '18:00'::time,
  false,
  false,
  'https://tickets.oztix.com.au/outlet/event/6ad51874-68ea-481b-aeb2-8fd32e7ebe30',
  'Cardcore',
  array['Card Show','Trading Cards','TCG','Pokemon','Melbourne','Thornbury','Food Trucks']::text[],
  'Cardcore Vol. 5 — TCG Takeover at Welcome to Thornbury',
  'Cardcore Vol. 5 takes over Welcome to Thornbury on Sunday 19 July 2026, 11am–6pm — curated TCG vendors, food trucks, arcade and a lucky dip for the first 100 through the door.'
where not exists (
  select 1 from public.events where slug = 'cardcore-vol-5-2026-07-19'
);

-- ── 2. Cardcore Sleepover — Seaworks, Williamstown ─────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  ticket_url, organizer_name,
  tags, seo_title, seo_description
)
select
  'card_show'::event_type,
  'approved'::event_status,
  'Cardcore Sleepover',
  'cardcore-sleepover-2026-09-12',
  'A two-day TCG weekender at Seaworks on Williamstown''s waterfront — VIP early entry, goodie bags and a $5,000 giveaway. Kids 12 and under free.',
  E'The [CARDCORE] Sleepover hits the Seaworks Maritime Precinct on Williamstown''s waterfront across Saturday 12 and Sunday 13 September 2026.\n\nSaturday runs VIP entry from 1pm and general admission 2pm – 9pm. VIP ticket holders get exclusive early entry, a VIP goodie bag and entry into a $5,000 giveaway. Kids 12 and under are free.\n\nTickets via Oztix — grab them early, Cardcore events fill up.',
  'Seaworks Maritime Precinct',
  '82 Nelson Place',
  'Williamstown',
  'VIC',
  '3016',
  '2026-09-12'::date,
  '2026-09-13'::date,
  false,
  false,
  'https://tickets.oztix.com.au/outlet/event/b178710c-188f-4ad8-903e-762421a8abbc',
  'Cardcore',
  array['Card Show','Trading Cards','TCG','Pokemon','Melbourne','Williamstown','Giveaway']::text[],
  'Cardcore Sleepover 2026 — TCG Weekender at Seaworks',
  'The Cardcore Sleepover takes over Seaworks, Williamstown on 12–13 September 2026 — two days of TCG trading with VIP goodie bags and a $5,000 giveaway. Kids 12 and under free.'
where not exists (
  select 1 from public.events where slug = 'cardcore-sleepover-2026-09-12'
);

-- ── 3. Newy Card Show — Newcastle Racecourse ───────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, suburb, state, postcode,
  start_date, start_time, end_time, is_free, entry_fee_aud, registration_required,
  website_url, ticket_url, organizer_name,
  featured_card_games, tags, seo_title, seo_description
)
select
  'card_show'::event_type,
  'approved'::event_status,
  'Newy Card Show',
  'newy-card-show-2026-09-27',
  'Newcastle''s number one card show — Pokémon, One Piece, Riftbound, MTG and sports cards at Newcastle Racecourse. $10 entry, kids 12 and under free.',
  E'The Newy Card Show returns to Newcastle Racecourse on Sunday 27 September 2026, 9am – 3pm.\n\nBuy, sell and trade across a wide range of trading cards — TCGs including Pokémon, One Piece, Riftbound and Magic: The Gathering, plus sports cards covering basketball, football (soccer), Formula One and more.\n\nGeneral entry is $10 for ages 13+; kids 12 and under are free with a paying adult. Ample free on-site parking at the racecourse. Tickets via TryBooking.',
  'Newcastle Racecourse',
  'Broadmeadow',
  'NSW',
  '2292',
  '2026-09-27'::date,
  '09:00'::time,
  '15:00'::time,
  false,
  10,
  false,
  'https://www.newycardshow.com.au',
  'https://www.trybooking.com/events/landing/1581803',
  'Newy Card Show',
  array['Pokémon','One Piece','Riftbound','Magic: The Gathering']::text[],
  array['Card Show','Trading Cards','Pokemon','Sports Cards','Newcastle','One Piece','Formula One']::text[],
  'Newy Card Show 2026 — Newcastle Trading Card Show',
  'The Newy Card Show hits Newcastle Racecourse on Sunday 27 September 2026, 9am–3pm — Pokémon, One Piece, MTG and sports cards. $10 entry, kids 12 and under free.'
where not exists (
  select 1 from public.events where slug = 'newy-card-show-2026-09-27'
);

-- ── 4. Outwest Card Show — Dubbo RSL ───────────────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, entry_fee_aud, registration_required,
  ticket_url, organizer_name,
  featured_card_games, tags, seo_title, seo_description
)
select
  'card_show'::event_type,
  'approved'::event_status,
  'Outwest Card Show',
  'outwest-card-show-dubbo-2026-10-03',
  'Regional NSW gets its own TCG show — trades, sales and grading advice at Dubbo RSL across Pokémon, Yu-Gi-Oh!, MTG and sports cards.',
  E'The Outwest Card Show brings the hobby to regional NSW at Dubbo RSL on Saturday 3 October 2026, 9am – 4pm.\n\nCollectors, players and enthusiasts of all ages are welcome — chase rare pulls, trade, sell collections or get expert guidance on card grading across Pokémon, Yu-Gi-Oh!, Magic: The Gathering, sports cards and more.\n\nTickets from $10 via 123tix (all sales final).',
  'Dubbo RSL',
  '178 Brisbane Street',
  'Dubbo',
  'NSW',
  '2830',
  '2026-10-03'::date,
  '09:00'::time,
  '16:00'::time,
  false,
  10,
  false,
  'https://www.123tix.com.au/events/51349/outwest-card-show',
  'Outwest Card Show',
  array['Pokémon','Yu-Gi-Oh!','Magic: The Gathering']::text[],
  array['Card Show','Trading Cards','Pokemon','Yu-Gi-Oh!','Sports Cards','Dubbo','Regional NSW','Grading']::text[],
  'Outwest Card Show 2026 — Dubbo Trading Card Show',
  'The Outwest Card Show hits Dubbo RSL on Saturday 3 October 2026, 9am–4pm — Pokémon, Yu-Gi-Oh!, MTG and sports cards with grading advice. Tickets from $10.'
where not exists (
  select 1 from public.events where slug = 'outwest-card-show-dubbo-2026-10-03'
);

-- ── 5. Brisbane Card Show — Distillery Road Market, Eagleby ────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time, is_free, entry_fee_aud, registration_required,
  website_url, ticket_url, organizer_name,
  tags, seo_title, seo_description
)
select
  'card_show'::event_type,
  'approved'::event_status,
  'Brisbane Card Show',
  'brisbane-card-show-2026-11-28',
  'Two days, 100+ vendors — rare cards, sealed product, on-site grading, learn-to-plays and trading zones at Distillery Road Market. Kids 12 and under free.',
  E'The Brisbane Card Show takes over Distillery Road Market in Eagleby on Saturday 28 and Sunday 29 November 2026, 10am – 4pm both days.\n\nShop top local and interstate sellers offering rare cards, sealed products and TCG accessories across 100+ friendly vendors. Submit cards for grading and authentication on-site, join the trading zones, or jump into a learn-to-play session.\n\nGeneral admission is $15 for ages 13+; kids 12 and under are free, with a limited kids'' early-entry option on Sunday from 9am. Free on-site parking plus a free shuttle bus from Beenleigh Station both days. Tickets via TryBooking.',
  'Distillery Road Market',
  '124 Distillery Road',
  'Eagleby',
  'QLD',
  '4207',
  '2026-11-28'::date,
  '2026-11-29'::date,
  '10:00'::time,
  '16:00'::time,
  false,
  15,
  false,
  'https://brisbanecardshow.com.au',
  'https://www.trybooking.com/events/landing/1523072',
  'Brisbane Card Show',
  array['Card Show','Trading Cards','Pokemon','Sports Cards','Brisbane','Grading','Trading Zone','Family Friendly']::text[],
  'Brisbane Card Show 2026 — Distillery Road Market, Eagleby',
  'The Brisbane Card Show runs 28–29 November 2026 at Distillery Road Market, Eagleby — 100+ vendors, on-site grading, trading zones and learn-to-plays. $15 entry, kids 12 and under free.'
where not exists (
  select 1 from public.events where slug = 'brisbane-card-show-2026-11-28'
);

-- ── 6. Oz Comic-Con Canberra — EPIC ────────────────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, suburb, state, postcode,
  start_date, end_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  tags, seo_title, seo_description
)
select
  'community_event'::event_type,
  'approved'::event_status,
  'Oz Comic-Con Canberra',
  'oz-comic-con-canberra-2026-08-15',
  'The pop-culture giant hits Canberra — with a strong trading-card and collectables presence alongside guests, cosplay and gaming.',
  E'Oz Comic-Con comes to Exhibition Park in Canberra (EPIC) on Saturday 15 and Sunday 16 August 2026, doors 10am – 4pm both days.\n\nAlongside the celebrity guests, cosplay and gaming, Oz Comic-Con draws a strong contingent of trading-card and collectables vendors — a good hunting ground for singles, slabs and sealed product in a city with few dedicated card shows.\n\nTickets are on sale now via ozcomiccon.com.',
  'Exhibition Park in Canberra (EPIC)',
  'Mitchell',
  'ACT',
  '2911',
  '2026-08-15'::date,
  '2026-08-16'::date,
  '10:00'::time,
  '16:00'::time,
  false,
  false,
  'https://ozcomiccon.com/canberra/',
  'https://ozcomiccon.com/canberra/',
  'Oz Comic-Con',
  array['Convention','Pop Culture','Trading Cards','Collectables','Cosplay','Canberra','ACT']::text[],
  'Oz Comic-Con Canberra 2026 — Pop Culture & Trading Cards',
  'Oz Comic-Con hits EPIC in Canberra on 15–16 August 2026 — pop culture, cosplay and a strong trading-card vendor presence. Tickets on sale now.'
where not exists (
  select 1 from public.events where slug = 'oz-comic-con-canberra-2026-08-15'
);

-- ── 7. Oz Comic-Con Sydney — Sydney Showground ─────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  tags, seo_title, seo_description
)
select
  'community_event'::event_type,
  'approved'::event_status,
  'Oz Comic-Con Sydney',
  'oz-comic-con-sydney-2026-09-12',
  'Sydney''s edition of the national pop-culture convention — guests, cosplay, gaming and a big trading-card and collectables vendor floor.',
  E'Oz Comic-Con returns to the Sydney Showground at Sydney Olympic Park on Saturday 12 and Sunday 13 September 2026.\n\nBeyond the celebrity guests, cosplay and gaming, the vendor floor carries a strong trading-card and collectables presence — singles, slabs, sealed product and memorabilia.\n\nTickets via ozcomiccon.com.',
  'Sydney Showground',
  'Sydney Olympic Park',
  'NSW',
  '2127',
  '2026-09-12'::date,
  '2026-09-13'::date,
  false,
  false,
  'https://ozcomiccon.com/sydney/',
  'https://ozcomiccon.com/sydney/',
  'Oz Comic-Con',
  array['Convention','Pop Culture','Trading Cards','Collectables','Cosplay','Sydney']::text[],
  'Oz Comic-Con Sydney 2026 — Pop Culture & Trading Cards',
  'Oz Comic-Con hits Sydney Showground, Sydney Olympic Park on 12–13 September 2026 — pop culture, cosplay and a big trading-card vendor floor.'
where not exists (
  select 1 from public.events where slug = 'oz-comic-con-sydney-2026-09-12'
);

-- ── 8. Oz Comic-Con Brisbane — BCEC ────────────────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  tags, seo_title, seo_description
)
select
  'community_event'::event_type,
  'approved'::event_status,
  'Oz Comic-Con Brisbane',
  'oz-comic-con-brisbane-2026-09-19',
  'Brisbane''s edition of the national pop-culture convention — guests, cosplay, gaming and a big trading-card and collectables vendor floor.',
  E'Oz Comic-Con lands at the Brisbane Convention & Exhibition Centre on Saturday 19 and Sunday 20 September 2026.\n\nBeyond the celebrity guests, cosplay and gaming, the vendor floor carries a strong trading-card and collectables presence — singles, slabs, sealed product and memorabilia.\n\nTickets via ozcomiccon.com.',
  'Brisbane Convention & Exhibition Centre',
  'South Brisbane',
  'QLD',
  '4101',
  '2026-09-19'::date,
  '2026-09-20'::date,
  false,
  false,
  'https://ozcomiccon.com/brisbane/',
  'https://ozcomiccon.com/brisbane/',
  'Oz Comic-Con',
  array['Convention','Pop Culture','Trading Cards','Collectables','Cosplay','Brisbane']::text[],
  'Oz Comic-Con Brisbane 2026 — Pop Culture & Trading Cards',
  'Oz Comic-Con hits the Brisbane Convention & Exhibition Centre on 19–20 September 2026 — pop culture, cosplay and a big trading-card vendor floor.'
where not exists (
  select 1 from public.events where slug = 'oz-comic-con-brisbane-2026-09-19'
);

-- ── 9. Supanova Adelaide — Adelaide Showground ─────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  tags, seo_title, seo_description
)
select
  'community_event'::event_type,
  'approved'::event_status,
  'Supanova Comic Con & Gaming – Adelaide',
  'supanova-adelaide-2026-10-30',
  'Three days of pop culture at Adelaide Showground — with trading-card and collectables vendors alongside the guests, cosplay and gaming.',
  E'Supanova Comic Con & Gaming returns to the Adelaide Showground from Friday 30 October to Sunday 1 November 2026, 10am – 6pm daily.\n\nAlongside the celebrity guests, cosplay and gaming, Supanova''s exhibitor floor draws trading-card and collectables vendors — a solid pickup opportunity the same weekend as Adelaide''s card scene winds up for the year.\n\nTicket sales open 21 July 2026 via supanova.com.au.',
  'Adelaide Showground',
  'Goodwood Road',
  'Wayville',
  'SA',
  '5034',
  '2026-10-30'::date,
  '2026-11-01'::date,
  '10:00'::time,
  '18:00'::time,
  false,
  false,
  'https://www.supanova.com.au/events/adelaide-2026/event-home/',
  'https://www.supanova.com.au/events/adelaide-2026/ticket-info/',
  'Supanova',
  array['Convention','Pop Culture','Trading Cards','Collectables','Cosplay','Adelaide']::text[],
  'Supanova Adelaide 2026 — Comic Con, Gaming & Trading Cards',
  'Supanova Comic Con & Gaming hits Adelaide Showground, Wayville from 30 October – 1 November 2026 — pop culture, cosplay, gaming and trading-card vendors.'
where not exists (
  select 1 from public.events where slug = 'supanova-adelaide-2026-10-30'
);

-- ── 10. Supanova Brisbane — BCEC ───────────────────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, suburb, state, postcode,
  start_date, end_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  tags, seo_title, seo_description
)
select
  'community_event'::event_type,
  'approved'::event_status,
  'Supanova Comic Con & Gaming – Brisbane',
  'supanova-brisbane-2026-11-06',
  'Three days of pop culture at the Brisbane Convention & Exhibition Centre — with trading-card and collectables vendors alongside the guests, cosplay and gaming.',
  E'Supanova Comic Con & Gaming returns to the Brisbane Convention & Exhibition Centre from Friday 6 to Sunday 8 November 2026, 10am – 6pm daily.\n\nAlongside the celebrity guests, cosplay and gaming, Supanova''s exhibitor floor draws trading-card and collectables vendors — singles, slabs, sealed product and memorabilia.\n\nTicket sales open 21 July 2026 via supanova.com.au.',
  'Brisbane Convention & Exhibition Centre',
  'South Brisbane',
  'QLD',
  '4101',
  '2026-11-06'::date,
  '2026-11-08'::date,
  '10:00'::time,
  '18:00'::time,
  false,
  false,
  'https://www.supanova.com.au/events/brisbane-2026/event-home/',
  'https://www.supanova.com.au/events/brisbane-2026/ticket-info/',
  'Supanova',
  array['Convention','Pop Culture','Trading Cards','Collectables','Cosplay','Brisbane']::text[],
  'Supanova Brisbane 2026 — Comic Con, Gaming & Trading Cards',
  'Supanova Comic Con & Gaming hits the Brisbane Convention & Exhibition Centre from 6–8 November 2026 — pop culture, cosplay, gaming and trading-card vendors.'
where not exists (
  select 1 from public.events where slug = 'supanova-brisbane-2026-11-06'
);
