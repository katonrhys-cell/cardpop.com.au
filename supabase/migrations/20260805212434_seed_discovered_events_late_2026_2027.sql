-- Draft 21 Australian trading-card events (TCG + sports) discovered by a web
-- sweep on 5 August 2026, covering the rest of 2026 and into 2027.
--
-- WHY THESE LAND AS DRAFTS, NOT APPROVED
-- --------------------------------------
-- Unlike the earlier seed migrations, every row here is inserted
-- `pending_review` + `auto_discovered = true` — the same state the nightly
-- scanner (`src/utils/eventScanner.js`) writes. That puts them behind the
-- "Found by scan" filter in Admin → Event Management for a human to approve one
-- at a time. Nothing here reaches the public calendar by itself.
--
-- That matters more than usual for this batch. The sweep could run web
-- *searches* but could not *fetch* any organiser page — the session's egress
-- policy refused every outbound host — so not one of these events was confirmed
-- by opening its source. Every field below comes from search-result content,
-- cross-checked across independent results.
--
-- The rules applied, so a reviewer knows what they are looking at:
--   * an event is here only if two or more independent sources agreed on its
--     date, or it comes from a publisher's own season schedule (Play! Pokémon);
--   * fields nobody confirmed are left NULL rather than guessed — no invented
--     postcodes, door prices or session times;
--   * every date was checked against the weekday its source implied (weekend
--     shows land on weekends, the three-day cons start on a Friday), which rules
--     out garbled dates even though it cannot prove an event is real;
--   * each description ends with a bracketed verification note naming what is
--     unconfirmed. Delete that line when approving.
--
-- DELIBERATELY NOT SEEDED — found, but too weak to put in front of a reviewer:
--   * the whole Supanova 2027 circuit (Gold Coast, Melbourne, Sydney, Perth,
--     Adelaide) — sourced from an exhibitor sales deck, with searches
--     contradicting each other on which city holds which June weekend, and two
--     legs having no resolvable date at all;
--   * Big Boyz Card Show at Seven Hills (20 Sep) and Bella Vista (15 Nov) —
--     both rest on a *vendor's* attendance calendar with no organiser listing;
--   * Oz Comic-Con Melbourne 2027 — unofficial aggregator, venue inferred;
--   * TCXPO Oran Park 16 May 2027 — a second search attributed the same date to
--     a different organiser at a different venue.
--
-- Already on the calendar and therefore skipped: Newy Card Show (27 Sep 2026),
-- Oz National Trading Card Show, Brisbane Trading Card Show, SA Card Show,
-- TreasureCon Perth, TCXPO Oran Park (6 Dec 2026), Big Boyz Wollongong.
--
-- Idempotent: each insert is skipped when its slug already exists.

-- ── Adelaide Pokemon Card Show (APCS) 4.0 — Sat 5 Sep 2026, SA ───────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state,
  start_date, start_time, end_time, is_free, entry_fee_aud, registration_required,
  ticket_url, instagram_url, facebook_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Adelaide Pokemon Card Show (APCS) 4.0',
  'adelaide-pokemon-card-show-apcs-4-2026-09-05',
  'Adelaide''s dedicated Pokémon show returns with 60+ vendor tables, graded slabs, sealed product and a foyer trade table. Ticketed — no door sales.',
  E'The fourth edition of the Adelaide Pokemon Card Show brings 60+ vendor tables of Pokémon singles, graded slabs and sealed collectibles to the Parafield Gardens Recreation Centre.\n\nA dedicated Trade Table runs in the foyer for collectors who want to meet and swap rather than buy. VIP early admission is 12:00pm–1:00pm ($17); general admission runs 1:00pm–4:00pm ($10). Children under 4 enter free.\n\nThis is a ticketed event with no door sales — book through TryBooking ahead of time. Organisers note there are no ATMs on site and not every vendor takes EFTPOS, so bring cash.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. Confirm the date, session times and pricing before approving. Postcode was not stated by any source and is left blank.]',
  'Parafield Gardens Recreation Centre',
  'Cnr Kings & Martins Roads',
  'Parafield Gardens',
  'SA',
  '2026-09-05'::date,
  '12:00'::time,
  '16:00'::time,
  false,
  10,
  true,
  'https://www.trybooking.com/events/landing/1566011',
  'https://www.instagram.com/pokemonadelaide/',
  'https://www.facebook.com/events/parafield-gardens-recreation-centre/adelaide-pokemon-card-show-apcs-40/1432053911724388/',
  'Adelaide Pokemon Card Show',
  array['Pokémon']::text[],
  array['Card Show','Pokemon','Adelaide','South Australia','Graded Cards','Sealed Product','Trade Table']::text[],
  'https://www.trybooking.com/events/landing/1566011',
  'Adelaide Pokemon Card Show 4.0 — 60+ Vendor Tables, Sept 2026',
  'The Adelaide Pokemon Card Show returns to Parafield Gardens on Saturday 5 September 2026 — 60+ vendor tables, graded slabs, sealed product and a foyer trade table. VIP entry from 12pm, general from 1pm.'
where not exists (
  select 1 from public.events where slug = 'adelaide-pokemon-card-show-apcs-4-2026-09-05'
);

-- ── Collect-A-Verse Card Show Canberra — Sat 5 Sep 2026, ACT ─────────────────
-- Only the second ACT event on the calendar, and the first dedicated card show
-- there.
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, entry_fee_aud, registration_required,
  organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Collect-A-Verse Card Show Canberra',
  'collect-a-verse-card-show-canberra-2026-09-05',
  '100+ vendor tables at Exhibition Park — Pokémon, Lorcana, One Piece, Magic, sports and entertainment cards. Free entry from 2pm.',
  E'Collect-A-Verse brings a one-day trading card expo to the Fitzroy Pavilion at Exhibition Park in Canberra, with 100+ vendor tables.\n\nThe floor covers Pokémon, Disney Lorcana, One Piece and Magic: The Gathering alongside sports trading cards and entertainment/non-sport cards.\n\nEntry is tiered: a $20 "Hardcore Collectors" ticket gets you in at 9:00am with a free pack of cards, $10 general admission opens at 10:30am, and entry is free from 2:00pm to 4:00pm. Children 0–12 enter free with a paying adult.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. No official website, ticket link or socials could be traced, and one aggregator showed a "you just missed it" banner that most likely refers to the earlier February 2026 Canberra event — but confirm this date has not moved before approving.]',
  'Fitzroy Pavilion, Exhibition Park in Canberra (EPIC)',
  'Corner of Flemington Road and Northbourne Avenue',
  'Mitchell',
  'ACT',
  '2911',
  '2026-09-05'::date,
  '09:00'::time,
  '16:00'::time,
  false,
  10,
  false,
  'Collect-A-Verse',
  array['Pokémon','Magic: The Gathering','One Piece','Lorcana']::text[],
  array['Card Show','Trading Cards','Canberra','ACT','Pokemon','Sports Cards','EPIC']::text[],
  'https://www.ozcardtrader.com.au/threads/collect-a-verse-card-show-canberra-saturday-5-september-2026.244845/',
  'Collect-A-Verse Card Show Canberra — 100+ Tables, Sept 2026',
  'Collect-A-Verse brings 100+ vendor tables to Exhibition Park in Canberra on Saturday 5 September 2026. Pokémon, Lorcana, One Piece, Magic and sports cards. Early entry from 9am, free entry from 2pm.'
where not exists (
  select 1 from public.events where slug = 'collect-a-verse-card-show-canberra-2026-09-05'
);

-- ── Collector Con Penrith (September) — Sun 20 Sep 2026, NSW ─────────────────
-- Collector Con publishes five 2026 Penrith dates (1 Mar, 31 May, 26 Jul,
-- 20 Sep, 22 Nov). The 26 Jul date on that list is already live on the calendar
-- and matches, which is what makes the two remaining dates trustworthy enough
-- to draft.
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, suburb, state,
  start_date, is_free, registration_required,
  website_url, ticket_url, instagram_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Collector Con Penrith (September)',
  'collector-con-penrith-september-2026',
  'The largest Collector Con venue at 400+ tables — trading cards alongside action figures, anime, comics, TTRPG, die-cast, LEGO and plush.',
  E'A later date in the recurring Collector Con Penrith series, the largest of the three Collector Con venues at 400+ trading tables.\n\nTrading cards sit alongside action figures, anime, comics, TTRPG and gaming, die-cast, LEGO and plush, so it is a broad toy and hobby fair rather than a cards-only show.\n\nActivations include tabletop role-playing, fan groups and a cosplay competition.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. The date comes from Collector Con''s list of five 2026 Penrith dates rather than a dedicated page for this instance. Session times, street address, postcode and ticket pricing are all unconfirmed and left blank.]',
  'Penrith Valley Regional Sports Centre',
  'Penrith',
  'NSW',
  '2026-09-20'::date,
  false,
  false,
  'https://collectorcon.com.au/collector-con-penrith/',
  'https://www.trybooking.com/eventlist/collectorcon',
  'https://www.instagram.com/collectorconau/',
  'Collector Con',
  array['Toy Fair','Collectables','Trading Cards','Penrith','Sydney','New South Wales','Cosplay']::text[],
  'https://collectorcon.com.au/collector-con-penrith-newcastle-and-campbelltown/',
  'Collector Con Penrith — 400+ Tables, September 2026',
  'Collector Con returns to Penrith Valley Regional Sports Centre on Sunday 20 September 2026 with 400+ trading tables. Trading cards, action figures, anime, comics, LEGO and a cosplay competition.'
where not exists (
  select 1 from public.events where slug = 'collector-con-penrith-september-2026'
);

-- ── Pokémon Brisbane Regional Championships — Sat 26–Sun 27 Sep 2026, QLD ────
-- Named for the city and calendar year rather than the season: this is the first
-- Oceania regional of the *2027* Championship Series but is played in Sept 2026,
-- and titling it "2027" would read as a year-out event on the calendar.
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Pokémon Brisbane Regional Championships',
  'pokemon-brisbane-regional-championships-2026-09-26',
  'Official Play! Pokémon Regional Championship — TCG, VGC and Pokémon GO divisions over two days at BCEC, opening the 2027 Championship Series in Oceania.',
  E'The Pokémon Brisbane Regional Championships are an official Play! Pokémon Regional-level event and the first Oceania stop of the 2027 Championship Series season.\n\nCompetition runs across the Trading Card Game, VGC (video game) and Pokémon GO divisions over two days at the Brisbane Convention & Exhibition Centre, with Championship Points awarded toward 2027 season standings.\n\nRegistration is handled through RK9 Labs and requires an RK9 profile and a Play! Pokémon Player ID.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the official page. Confirm competitor entry fees, the division schedule and start times on RK9 before approving. Sources disagreed on whether the BCEC street address is Merivale St or Grey St, so it is left blank.]',
  'Brisbane Convention & Exhibition Centre, Hall 4',
  'South Brisbane',
  'QLD',
  '4101',
  '2026-09-26'::date,
  '2026-09-27'::date,
  false,
  true,
  'https://championships.pokemon.com/en-us/events/',
  'https://rk9.gg/event/pokemon-brisbane-2026',
  'The Pokémon Company International (Play! Pokémon)',
  array['Pokémon']::text[],
  array['Pokemon','Regional Championships','Play Pokemon','Tournament','Brisbane','Queensland','VGC','Pokemon GO']::text[],
  'https://rk9.gg/event/pokemon-brisbane-2026',
  'Pokémon Brisbane Regional Championships — Sept 2026, BCEC',
  'Official Play! Pokémon Regional Championships at the Brisbane Convention & Exhibition Centre, 26–27 September 2026. TCG, VGC and Pokémon GO divisions with Championship Points toward the 2027 season.'
where not exists (
  select 1 from public.events where slug = 'pokemon-brisbane-regional-championships-2026-09-26'
);

-- ── Perth TCG Fest — Sun 27 Sep 2026, WA ────────────────────────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, registration_required,
  website_url, instagram_url, facebook_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Perth TCG Fest',
  'perth-tcg-fest-2026-09-27',
  'The Perth Card Fest team''s TCG-focused show — 90+ vendor tables, trade zones and creators across Pokémon, Yu-Gi-Oh!, Magic, One Piece, Dragon Ball and Lorcana.',
  E'Perth TCG Fest is a dedicated trading-card-game show from the Perth Card Fest team, held at Kingsway Indoor Stadium in Madeley.\n\nThe event lists 90+ vendor tables plus trade zones and local creators, covering Pokémon, Yu-Gi-Oh!, Magic: The Gathering, Dragon Ball, One Piece and Disney Lorcana. It is a TCG-only spin-off from the main Perth Card Fest, so there is little to no sports-card content.\n\nGeneral admission runs 10:00am–2:00pm with VIP early entry from 9:00am. Children 10 and under enter free, and there is free on-site parking.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. Tickets were not yet on sale at the time of the sweep, so entry and VIP fees are blank — confirm before approving.]',
  'Kingsway Indoor Stadium',
  '130 Kingsway',
  'Madeley',
  'WA',
  '6065',
  '2026-09-27'::date,
  '10:00'::time,
  '14:00'::time,
  false,
  false,
  'https://www.perthcardfest.org/events/perth-tcg-fest-2',
  'https://www.instagram.com/perthcardfest/',
  'https://www.facebook.com/events/kingsway-indoor-stadium/perth-tcg-fest/805668395236662/',
  'Perth Card Fest',
  array['Pokémon','Yu-Gi-Oh!','Magic: The Gathering','One Piece','Dragon Ball Super','Lorcana']::text[],
  array['Card Show','TCG','Perth','Western Australia','Pokemon','Trade Zone','Vendors']::text[],
  'https://www.perthcardfest.org/events/perth-tcg-fest-2',
  'Perth TCG Fest — 90+ Vendor Tables, Kingsway, Sept 2026',
  'Perth TCG Fest brings 90+ vendor tables, trade zones and creators to Kingsway Indoor Stadium on Sunday 27 September 2026. Pokémon, Yu-Gi-Oh!, Magic, One Piece, Dragon Ball and Lorcana. Kids 10 and under free.'
where not exists (
  select 1 from public.events where slug = 'perth-tcg-fest-2026-09-27'
);

-- ── PAX Aus 2026 — Fri 9–Sun 11 Oct 2026, VIC ───────────────────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time, is_free, registration_required,
  website_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'PAX Aus 2026',
  'pax-aus-2026-10-09',
  'Australia''s largest gaming convention returns to MCEC for three days, with a substantial tabletop and TCG floor including publisher demos and tournaments.',
  E'PAX Aus, Australia''s largest gaming convention, runs three days at the Melbourne Convention and Exhibition Centre.\n\nAlongside the video game floor it carries a substantial tabletop and trading-card presence — publisher demos, organised play and tournaments — though it is a gaming convention rather than a card show, with no sports-card content.\n\nExpo Hall hours are 10:00am–6:00pm each day, with the wider event running until 11:30pm on Friday and Saturday and closing at 6:00pm on Sunday.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the official page. Ticket pricing and the extent of the dedicated trading-card vendor hall are unconfirmed.]',
  'Melbourne Convention and Exhibition Centre',
  '1 Convention Centre Place',
  'South Wharf',
  'VIC',
  '3006',
  '2026-10-09'::date,
  '2026-10-11'::date,
  '10:00'::time,
  '18:00'::time,
  false,
  true,
  'https://aus.paxsite.com/',
  'ReedPop',
  array['Magic: The Gathering','Pokémon']::text[],
  array['Gaming Convention','Tabletop','TCG','Melbourne','Victoria','Tournaments','PAX']::text[],
  'https://aus.paxsite.com/en-us/info/news/2026-dates.html',
  'PAX Aus 2026 — Australia''s Largest Gaming Convention, MCEC',
  'PAX Aus returns to the Melbourne Convention and Exhibition Centre from 9–11 October 2026. Three days of gaming with a substantial tabletop and trading-card floor, publisher demos and tournaments.'
where not exists (
  select 1 from public.events where slug = 'pax-aus-2026-10-09'
);

-- ── Nexus Toy & Collectors Fair — Sat 10 Oct 2026, WA ───────────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, entry_fee_aud, registration_required,
  website_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Nexus Toy & Collectors Fair',
  'nexus-toy-collectors-fair-2026-10-10',
  'WA''s longest-running toy and collectables expo — trading cards alongside Lego, model cars, retro games and coins. $5 at the door, under 8s free.',
  E'The Nexus Toy & Collectors Fair is Western Australia''s longest-running toy and collectables expo, held four times a year at East Victoria Park.\n\nTrading cards sit alongside the fair''s other collecting categories — Lego, model cars, video games, books, art, magazines, dolls, coins and movie memorabilia — so it is a broad collectables morning rather than a dedicated card show.\n\nEntry is $5 per person at the door with children under 8 free. There are no presale tickets; door sales only. Doors 9:00am–12:00pm.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. The venue building name was not stated in any source (street address only), and the scale of the trading-card presence is unconfirmed. Check both before approving.]',
  '34 Kent Street',
  'East Victoria Park',
  'WA',
  '6101',
  '2026-10-10'::date,
  '09:00'::time,
  '12:00'::time,
  false,
  5,
  false,
  'https://www.perthtoyfair.com/',
  'Nexus Toy & Collectors Fair',
  array['Toy Fair','Collectables','Trading Cards','Perth','Western Australia','Retro Games','Coins']::text[],
  'https://www.perthtoyfair.com/',
  'Nexus Toy & Collectors Fair — Perth, October 2026',
  'WA''s longest-running toy and collectables expo returns to East Victoria Park on Saturday 10 October 2026. Trading cards, Lego, model cars, retro games and coins. $5 entry at the door, under 8s free.'
where not exists (
  select 1 from public.events where slug = 'nexus-toy-collectors-fair-2026-10-10'
);

-- ── Big Boyz Card Show – St Marys — Sun 18 Oct 2026, NSW ────────────────────
-- The one Big Boyz date worth drafting: it was already flagged as a known-but-
-- unlistable candidate in the 16 Jul 2026 seed batch ("St Marys, 18 Oct — no
-- listing yet"), and two independent calendars have since landed on the same
-- date. Its Seven Hills and Bella Vista siblings did not clear that bar.
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, suburb, state,
  start_date, is_free, registration_required,
  facebook_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Big Boyz Card Show – St Marys',
  'big-boyz-card-show-st-marys-october-2026',
  'The Big Boyz circuit lands at St Marys Leagues Club — TCG singles, sports cards and graded slabs across Western Sydney''s regular card-show run.',
  E'A Big Boyz Card Show date at St Marys Leagues Club in Western Sydney, a venue the series has used before.\n\nThe floor is card-focused — TCG singles, sports cards (NRL, AFL, NBA) and graded slabs — with some pop-culture collectables alongside.\n\n[CardPop draft — found by an automated web sweep and the least directly sourced event in this batch: the date appears on two vendor attendance calendars rather than a Big Boyz listing, though it matches a candidate flagged during earlier research. Confirm the date, times and entry fee on the organiser''s Facebook page before approving. Street address, postcode, times and fee are all unconfirmed and left blank.]',
  'St Marys Leagues Club',
  'St Marys',
  'NSW',
  '2026-10-18'::date,
  false,
  false,
  'https://www.facebook.com/p/Big-Boyz-Card-Show-61574125569763/',
  'Big Boyz Card Show',
  array['Pokémon']::text[],
  array['Card Show','Trading Cards','Sports Cards','Graded Cards','St Marys','Western Sydney','New South Wales']::text[],
  'https://phoenyxcurios.com.au/pages/event-calendar',
  'Big Boyz Card Show St Marys — Western Sydney, October 2026',
  'The Big Boyz Card Show circuit returns to St Marys Leagues Club on Sunday 18 October 2026. TCG singles, sports cards and graded slabs across Western Sydney''s regular card-show run.'
where not exists (
  select 1 from public.events where slug = 'big-boyz-card-show-st-marys-october-2026'
);

-- ── Collector Con Campbelltown — Sun 25 Oct 2026, NSW ───────────────────────
-- A third Collector Con venue, distinct from the Penrith and Newcastle legs
-- already on the calendar. Note the venue is in Minto, not Campbelltown proper.
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, instagram_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Collector Con Campbelltown',
  'collector-con-campbelltown-2026-10-25',
  'Three halls and 250+ trading tables at Minto — trading cards alongside action figures, comics, dolls, die-cast, LEGO and model trains.',
  E'Collector Con brings its toy, hobby and pop culture fair to the Minto Indoor Sports Centre, spanning three halls with 250+ trading tables.\n\nTrading cards are one category among action figures, comics, dolls, die-cast, LEGO and model trains, so it is a general collectables fair rather than a cards-only show.\n\nTicket tiers are an 8:30am early bird (limited, online only) plus 9:30am and 11:30am general admission, available online and at the door if not sold out. Children aged 0–12 enter free. Scooby-Doo voice actor Neil Fanning is listed for photo ops, meet-and-greets and autographs.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. Exact early-bird and general admission prices could not be confirmed and are left blank.]',
  'Minto Indoor Sports Centre',
  '9 Redfern Road',
  'Minto',
  'NSW',
  '2566',
  '2026-10-25'::date,
  '09:30'::time,
  '15:00'::time,
  false,
  false,
  'https://collectorcon.com.au/collector-con-campbelltown/',
  'https://www.trybooking.com/events/landing/1517587',
  'https://www.instagram.com/collectorconau/',
  'Collector Con',
  array['Toy Fair','Collectables','Trading Cards','Campbelltown','Minto','Sydney','New South Wales']::text[],
  'https://www.trybooking.com/events/landing/1517587',
  'Collector Con Campbelltown — 250+ Tables at Minto, Oct 2026',
  'Collector Con brings three halls and 250+ trading tables to Minto Indoor Sports Centre on Sunday 25 October 2026. Trading cards, action figures, comics, die-cast, LEGO and model trains. Kids 0–12 free.'
where not exists (
  select 1 from public.events where slug = 'collector-con-campbelltown-2026-10-25'
);

-- ── APCS Brisbane Toy & Hobby Fair — Sun 1 Nov 2026, QLD ────────────────────
-- Deferred from the 16 Jul 2026 seed batch ("free entry, no bookings, conflicting
-- dates"); the 1 Nov 2026 date now agrees across the venue's own listing and two
-- independent event aggregators, so it comes back as a draft to be checked.
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state,
  start_date, start_time, end_time, is_free, entry_fee_aud, registration_required,
  website_url, instagram_url, facebook_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'APCS Brisbane Toy & Hobby Fair',
  'apcs-brisbane-toy-hobby-fair-2026-11-01',
  'Free-entry toy and hobby fair with a strong sports-card presence — trading cards, sports collectables, vintage toys, model trains and slot cars.',
  E'Australia''s Premier Collectables Show brings its toy and hobby fair back to Nissan Arena at Nathan.\n\nThe floor covers sports trading cards and sports collectables alongside model trains, books, vintage toys and slot cars — the card presence leans sports rather than TCG, so it suits collectors chasing NRL, AFL and cricket product.\n\nEntry is free and no booking is required. Doors 9:00am–3:00pm.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the venue''s page. An earlier attempt to list this show was shelved because sources disagreed on the date, so confirm 1 November 2026 with the organiser before approving. Postcode left blank rather than assumed.]',
  'Nissan Arena',
  '590 Mains Road',
  'Nathan',
  'QLD',
  '2026-11-01'::date,
  '09:00'::time,
  '15:00'::time,
  true,
  0,
  false,
  'http://www.ashow.com.au/',
  'https://www.instagram.com/apcs_events/',
  'https://www.facebook.com/apcs007/',
  'APCS (Australia''s Premier Collectables Show)',
  array['Toy Fair','Sports Cards','Collectables','Brisbane','Queensland','Free Entry','Vintage Toys']::text[],
  'https://nissanarena.com.au/apcs-toys-hobby-fair/',
  'APCS Brisbane Toy & Hobby Fair — Free Entry, Nov 2026',
  'Australia''s Premier Collectables Show returns to Nissan Arena, Nathan on Sunday 1 November 2026. Sports trading cards, collectables, vintage toys, model trains and slot cars. Free entry, no bookings.'
where not exists (
  select 1 from public.events where slug = 'apcs-brisbane-toy-hobby-fair-2026-11-01'
);

-- ── ANZ MTG Super Series Regional Championships #13 — Fri 6–Sun 8 Nov 2026, NSW
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state,
  start_date, end_date, is_free, registration_required,
  website_url, facebook_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'ANZ MTG Super Series Regional Championships #13',
  'anz-mtg-super-series-regional-championships-13-2026-11-06',
  'The Australia/NZ Regional Championship for Magic: The Gathering — Modern Constructed, with cash prizes and Pro Tour invitations on the line.',
  E'Regional Championships #13 is the Australia/New Zealand Regional Championship for Magic: The Gathering, run as the finals of an ANZ MTG Super Series cycle at Club Central Hurstville.\n\nThe format is Modern Constructed. Players qualify through Store Qualifiers, City Qualifiers and Last Chance Qualifiers run across the cycle, and top finishers earn cash prizes plus invitations to the Pro Tour.\n\nThree days of competition, with side events running alongside the main tournament.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page, and the only event in this batch resting on a single source. Confirm the dates, format and entry fee on anzmtg.com.au before approving. Postcode left blank rather than assumed.]',
  'Club Central Hurstville',
  '2 Crofts Avenue',
  'Hurstville',
  'NSW',
  '2026-11-06'::date,
  '2026-11-08'::date,
  false,
  true,
  'https://anzmtg.com.au/regional-championships/69bb2c23c5d0f334725da10d/',
  'https://www.facebook.com/anzmtgss/',
  'ANZ MTG Super Series',
  array['Magic: The Gathering']::text[],
  array['Magic The Gathering','Regional Championship','Modern','Tournament','Sydney','Hurstville','Pro Tour Qualifier']::text[],
  'https://anzmtg.com.au/regional-championships/69bb2c23c5d0f334725da10d/',
  'ANZ MTG Regional Championships #13 — Modern, Sydney Nov 2026',
  'The Australia/NZ Magic: The Gathering Regional Championship runs 6–8 November 2026 at Club Central Hurstville. Modern Constructed, with cash prizes and Pro Tour invitations for top finishers.'
where not exists (
  select 1 from public.events where slug = 'anz-mtg-super-series-regional-championships-13-2026-11-06'
);

-- ── Hobby Con Au Liverpool — Sat 14 Nov 2026, NSW ───────────────────────────
-- A separate venue from the Glebe edition already on the calendar.
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, registration_required,
  ticket_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Hobby Con Au Liverpool',
  'hobby-con-au-liverpool-2026-11-14',
  'A South-West Sydney card show mixing sports cards (NBA, NFL, NRL, AFL, soccer, UFC, F1) with Pokémon, One Piece, Yu-Gi-Oh! and Lorcana, plus on-site grading submissions.',
  E'Hobby Con Au brings a trading card show to Liverpool''s Whitlam Leisure Centre, its second date at this venue in 2026.\n\nThe venue''s card shows run a mix of sports cards — NBA, NFL, NRL, AFL, soccer, UFC and F1 — alongside TCGs including Pokémon, One Piece, Yu-Gi-Oh! and Disney Lorcana, with on-site grading submission vendors.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. Ticket prices are deliberately blank: the pricing that surfaced belongs to a *different* card show running at the same venue, and it could not be confirmed that Hobby Con Au uses the same tiers. The featured games are inferred from the venue''s card-show profile rather than a Hobby Con Au Liverpool listing. Confirm both, and that the TryBooking link maps to this date, before approving.]',
  'Whitlam Leisure Centre',
  '90 Memorial Drive',
  'Liverpool',
  'NSW',
  '2170',
  '2026-11-14'::date,
  '09:00'::time,
  '16:00'::time,
  false,
  false,
  'https://www.trybooking.com/events/landing/1547777',
  'Hobby Con Au',
  array['Pokémon','One Piece','Yu-Gi-Oh!','Magic: The Gathering','Lorcana']::text[],
  array['Card Show','Trading Cards','Sports Cards','Liverpool','South West Sydney','New South Wales','Grading']::text[],
  'https://www.trybooking.com/events/landing/1547777',
  'Hobby Con Au Liverpool — Card Show, November 2026',
  'Hobby Con Au returns to Whitlam Leisure Centre, Liverpool on Saturday 14 November 2026. Sports cards, Pokémon, One Piece, Yu-Gi-Oh! and Lorcana, with on-site PSA, BGS and CGC grading submissions.'
where not exists (
  select 1 from public.events where slug = 'hobby-con-au-liverpool-2026-11-14'
);

-- ── Perth Card Fest 7 — Sat 21 Nov 2026, WA ─────────────────────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, is_free, registration_required,
  website_url, instagram_url, facebook_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Perth Card Fest 7',
  'perth-card-fest-7-2026-11-21',
  'WA''s premier trading card event returns to Claremont Showground — stalls, vendors and local creatives across sports cards and TCGs.',
  E'Perth Card Fest returns to Claremont Showground for its seventh edition, announced by the organiser as "PCF 7 IS BACK NOVEMBER 21ST".\n\nPerth Card Fest bills itself as Western Australia''s premier trading card event, bringing together enthusiasts, players and collectors of all ages across a marketplace of stalls, vendors and local creatives, covering both sports cards and TCGs.\n\nPrevious editions ran as single-day Saturday shows at Claremont Showground, typically 10:00am–4:00pm.\n\n[CardPop draft — the weakest date in this batch. The organiser announced only "November 21st" with no year; 2026 is inferred because it falls on a Saturday and matches the series'' Saturday-at-Claremont cadence (PCF 5 in March 2026, PCF 6 in July 2026). Verify the year with the organiser before approving. Times, entry fee and the pavilion are unconfirmed and left blank — one source named the Robinson Pavilion but could not be corroborated.]',
  'Claremont Showground',
  '1 Graylands Road',
  'Claremont',
  'WA',
  '6010',
  '2026-11-21'::date,
  false,
  false,
  'https://www.perthcardfest.org/',
  'https://www.instagram.com/perthcardfest/',
  'https://www.facebook.com/p/Perth-Card-Fest-61566781180566/',
  'Perth Card Fest',
  array['Card Show','Trading Cards','Sports Cards','Perth','Western Australia','Claremont','Vendors']::text[],
  'https://www.perthcardfest.org/',
  'Perth Card Fest 7 — Claremont Showground, November 2026',
  'Perth Card Fest returns to Claremont Showground for its seventh edition on Saturday 21 November 2026 — WA''s premier trading card event with stalls, vendors and local creatives.'
where not exists (
  select 1 from public.events where slug = 'perth-card-fest-7-2026-11-21'
);

-- ── Collector Con Penrith (November) — Sun 22 Nov 2026, NSW ─────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, suburb, state,
  start_date, is_free, registration_required,
  website_url, ticket_url, instagram_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Collector Con Penrith (November)',
  'collector-con-penrith-november-2026',
  'The final 2026 Penrith date — 400+ trading tables of cards, action figures, comics, die-cast and LEGO, with cosplay and tabletop gaming.',
  E'The final 2026 date in the recurring Collector Con Penrith series, and the largest of the three Collector Con venues at 400+ trading tables.\n\nTrading cards sit among action figures, anime, comics, TTRPG and gaming, die-cast, LEGO and plush. Cosplay competition and tabletop gaming activations run through the day.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. The date comes from Collector Con''s list of five 2026 Penrith dates rather than a dedicated page for this instance. Session times, street address, postcode and ticket pricing are unconfirmed and left blank.]',
  'Penrith Valley Regional Sports Centre',
  'Penrith',
  'NSW',
  '2026-11-22'::date,
  false,
  false,
  'https://collectorcon.com.au/collector-con-penrith/',
  'https://www.trybooking.com/eventlist/collectorcon',
  'https://www.instagram.com/collectorconau/',
  'Collector Con',
  array['Toy Fair','Collectables','Trading Cards','Penrith','Sydney','New South Wales','Cosplay']::text[],
  'https://collectorcon.com.au/collector-con-penrith-newcastle-and-campbelltown/',
  'Collector Con Penrith — 400+ Tables, November 2026',
  'Collector Con closes its 2026 Penrith run at Penrith Valley Regional Sports Centre on Sunday 22 November 2026. 400+ trading tables of cards, action figures, comics, die-cast and LEGO, plus cosplay.'
where not exists (
  select 1 from public.events where slug = 'collector-con-penrith-november-2026'
);

-- ── Pokémon Sydney Regional Championships — Sat 16–Sun 17 Jan 2027, NSW ─────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  state,
  start_date, end_date, is_free, registration_required,
  website_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Pokémon Sydney Regional Championships 2027',
  'pokemon-sydney-regional-championships-2027-01-16',
  'Official Play! Pokémon Regional Championship on the 2027 season calendar — Championship Points across TCG and video game divisions. Venue to be announced.',
  E'The Pokémon Sydney Regional Championships are an official Play! Pokémon Regional-level event in the 2027 Championship Series season, awarding Championship Points across the Trading Card Game and video game divisions.\n\nThe dates appear on the preliminary 2027 season calendar released in July 2026.\n\nThe venue has not been announced. The 2026 Sydney Regional was held at the ICC Sydney Exhibition Centre, but that should not be assumed for 2027 — watch the Play! Pokémon events page and RK9 for the announcement.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the official page. Venue, entry fees, session times and the registration link are all genuinely unannounced and left blank on purpose — do not fill them in from the 2026 event.]',
  'NSW',
  '2027-01-16'::date,
  '2027-01-17'::date,
  false,
  true,
  'https://championships.pokemon.com/en-us/events/',
  'The Pokémon Company International (Play! Pokémon)',
  array['Pokémon']::text[],
  array['Pokemon','Regional Championships','Play Pokemon','Tournament','Sydney','New South Wales','2027 Season']::text[],
  'https://championships.pokemon.com/en-us/events/',
  'Pokémon Sydney Regional Championships — January 2027',
  'Official Play! Pokémon Regional Championships in Sydney, 16–17 January 2027. Championship Points across TCG and video game divisions for the 2027 season. Venue to be announced.'
where not exists (
  select 1 from public.events where slug = 'pokemon-sydney-regional-championships-2027-01-16'
);

-- ── CollectFest Perth 2027 — Sat 13–Sun 14 Feb 2027, WA ────────────────────
-- CollectFest runs a four-city 2027 season (Perth, Brisbane, Melbourne, Sydney);
-- all four are drafted below in date order.
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, suburb, state,
  start_date, end_date, is_free, registration_required,
  website_url, ticket_url, facebook_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'CollectFest Perth 2027',
  'collectfest-perth-2027-02-13',
  'CollectFest comes to Perth for the first time — trading cards and graded slabs alongside sneakers, coins, comics, toys and sports memorabilia.',
  E'CollectFest describes itself as Australia''s first festival for all collectables, and expands to Perth for the first time in 2027 at the Perth Convention and Exhibition Centre.\n\nThe two-day festival spans trading cards and graded slabs alongside sneakers, coins, comics, toys and figurines, blind boxes, retro games, anime and sports memorabilia.\n\nIt opens a four-city 2027 run, followed by Brisbane (6–7 March), Melbourne (3–4 April) and Sydney (10–11 April).\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. One search returned 13–15 February rather than 13–14, so confirm the run length. Session times and the full venue address are unconfirmed, and adult admission was quoted only as a $40–$60 range spanning ticket tiers, so no entry fee has been recorded.]',
  'Perth Convention and Exhibition Centre',
  'Perth',
  'WA',
  '2027-02-13'::date,
  '2027-02-14'::date,
  false,
  false,
  'https://collectfest.com.au/',
  'https://collectfest.com.au/tickets/',
  'https://www.facebook.com/collectfest/',
  'Exhibitions & Events Australia',
  array['Collectables Festival','Trading Cards','Graded Cards','Sports Memorabilia','Perth','Western Australia','Sneakers','Comics']::text[],
  'https://collectfest.com.au/',
  'CollectFest Perth 2027 — Australia''s Collectables Festival',
  'CollectFest comes to the Perth Convention and Exhibition Centre on 13–14 February 2027. Trading cards and graded slabs alongside sneakers, coins, comics, toys and sports memorabilia.'
where not exists (
  select 1 from public.events where slug = 'collectfest-perth-2027-02-13'
);

-- ── CollectFest Brisbane 2027 — Sat 6–Sun 7 Mar 2027, QLD ──────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, facebook_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'CollectFest Brisbane 2027',
  'collectfest-brisbane-2027-03-06',
  '160+ exhibitors, live tournaments and 8,000+ collectors at BCEC — trading cards, sneakers, coins, comics and memorabilia under one roof.',
  E'CollectFest bills itself as Australia''s first and only festival for all things collectable, uniting trading cards, sneakers, coins and comics under one roof.\n\nThe Brisbane edition returns to the Brisbane Convention & Exhibition Centre with more than 160 exhibitors, live tournaments and interactive experiences, and has drawn over 8,000 collectors in past years.\n\nDoors 10:00am–5:00pm both days. It is the second stop of the four-city 2027 run, after Perth (13–14 February) and before Melbourne (3–4 April) and Sydney (10–11 April).\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. Ticketing was quoted as ranges across tiers (adult $40–$120, child $30–$60, family $150–$300), so no single entry fee has been recorded. One aggregator also showed an unrelated July date — confirm 6–7 March before approving.]',
  'Brisbane Convention & Exhibition Centre',
  '75 Merivale Street',
  'South Brisbane',
  'QLD',
  '4101',
  '2027-03-06'::date,
  '2027-03-07'::date,
  '10:00'::time,
  '17:00'::time,
  false,
  false,
  'https://collectfest.com.au/',
  'https://collectfest.com.au/tickets/',
  'https://www.facebook.com/collectfest/',
  'Exhibitions & Events Australia',
  array['Collectables Festival','Trading Cards','Graded Cards','Sports Memorabilia','Brisbane','Queensland','Tournaments','Comics']::text[],
  'https://collectfest.com.au/',
  'CollectFest Brisbane 2027 — 160+ Exhibitors at BCEC',
  'CollectFest returns to the Brisbane Convention & Exhibition Centre on 6–7 March 2027 with 160+ exhibitors, live tournaments and 8,000+ collectors. Trading cards, sneakers, coins, comics and memorabilia.'
where not exists (
  select 1 from public.events where slug = 'collectfest-brisbane-2027-03-06'
);

-- ── Oz Comic-Con Adelaide 2027 — Sat 13–Sun 14 Mar 2027, SA ────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Oz Comic-Con Adelaide 2027',
  'oz-comic-con-adelaide-2027-03-13',
  'Oz Comic-Con returns to Adelaide Showground for two days of pop culture, with a vendor hall that traditionally includes trading card and collectibles sellers.',
  E'Oz Comic-Con returns to Adelaide Showground for a two-day pop culture convention, with doors open 10:00am to 4:30pm both Saturday and Sunday.\n\nAs a general pop-culture expo it hosts a large vendor hall that typically includes trading card and collectibles sellers alongside comics, anime and merchandise, plus guest signings and cosplay programming.\n\nOz Comic-Con states tickets go on sale roughly three to four months out from each event, and that prices are higher at the door than online.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. CHECK THE CITY, not just the date: Oz Comic-Con Adelaide ran in late May in 2026, and March is historically the *Perth* slot, so there is a real chance 13–14 March 2027 belongs to Perth and the two city pages were conflated. 2027 ticket pricing is not yet released, and no source specifically confirms trading-card vendors for this edition — it is drafted on the same basis as the other pop-culture conventions already on the calendar.]',
  'Adelaide Showground',
  'Goodwood Road',
  'Wayville',
  'SA',
  '5034',
  '2027-03-13'::date,
  '2027-03-14'::date,
  '10:00'::time,
  '16:30'::time,
  false,
  false,
  'https://ozcomiccon.com/adelaide/',
  'https://ozcomiccon.com/adelaide/',
  'Oz Comic-Con',
  array['Comic Con','Pop Culture','Collectables','Trading Cards','Adelaide','South Australia','Cosplay']::text[],
  'https://ozcomiccon.com/adelaide/',
  'Oz Comic-Con Adelaide 2027 — Adelaide Showground, March',
  'Oz Comic-Con returns to Adelaide Showground on 13–14 March 2027, 10am–4:30pm daily. Pop culture, guest signings, cosplay and a vendor hall with trading cards and collectibles.'
where not exists (
  select 1 from public.events where slug = 'oz-comic-con-adelaide-2027-03-13'
);

-- ── CollectFest Melbourne 2027 — Sat 3–Sun 4 Apr 2027, VIC ─────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, ticket_url, facebook_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'CollectFest Melbourne 2027',
  'collectfest-melbourne-2027-04-03',
  '200+ exhibitors and 10,000+ attendees at MCEC — trading cards, sports memorabilia, comics, toys and pop culture, with live tournaments and interactive zones.',
  E'CollectFest returns to the Melbourne Convention & Exhibition Centre for the third stop of its four-city 2027 run.\n\nThe festival covers trading cards and graded slabs, sports memorabilia, comics, toys and pop culture, and has drawn 200+ exhibitors and over 10,000 attendees, with live tournaments and interactive zones running across the weekend.\n\nPerth (13–14 February) and Brisbane (6–7 March) come first; Sydney (10–11 April) closes the run the following weekend.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. Session times and 2027 ticket pricing are unconfirmed. Confirm the 3–4 April date before approving; a separate search returned a conflicting July date for the Melbourne edition.]',
  'Melbourne Convention & Exhibition Centre',
  '1 Convention Centre Place',
  'South Wharf',
  'VIC',
  '3006',
  '2027-04-03'::date,
  '2027-04-04'::date,
  false,
  false,
  'https://collectfest.com.au/',
  'https://collectfest.com.au/tickets/',
  'https://www.facebook.com/collectfest/',
  'Exhibitions & Events Australia',
  array['Collectables Festival','Trading Cards','Graded Cards','Sports Memorabilia','Melbourne','Victoria','Tournaments','Comics']::text[],
  'https://collectfest.com.au/',
  'CollectFest Melbourne 2027 — 200+ Exhibitors at MCEC',
  'CollectFest returns to the Melbourne Convention & Exhibition Centre on 3–4 April 2027 with 200+ exhibitors and 10,000+ attendees. Trading cards, sports memorabilia, comics, toys and live tournaments.'
where not exists (
  select 1 from public.events where slug = 'collectfest-melbourne-2027-04-03'
);

-- ── CollectFest Sydney 2027 — Sat 10–Sun 11 Apr 2027, NSW ──────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, facebook_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'CollectFest Sydney 2027',
  'collectfest-sydney-2027-04-10',
  'Hundreds of traders at ICC Sydney with show-only exclusives — trading cards, sports memorabilia, retro gaming, coins, stamps, toys and figurines.',
  E'CollectFest closes its four-city 2027 run at ICC Sydney in Darling Harbour.\n\nThe festival celebrates pop culture, fandoms and collectables with hundreds of traders, exclusive show-only items, live activations and immersive zones. Categories span trading cards, sports memorabilia, retro gaming, coins and stamps, toys and figurines.\n\nDoors 10:00am–5:00pm both days.\n\n[CardPop draft — found by an automated web sweep, not yet verified against the organiser''s page. Ticketing spans a wide range across tiers and add-ons, so no single entry fee has been recorded — confirm the tier structure and on-sale date before approving.]',
  'ICC Sydney',
  '14 Darling Drive',
  'Sydney',
  'NSW',
  '2000',
  '2027-04-10'::date,
  '2027-04-11'::date,
  '10:00'::time,
  '17:00'::time,
  false,
  false,
  'https://collectfest.com.au/',
  'https://collectfest.com.au/tickets/',
  'https://www.facebook.com/collectfest/',
  'Exhibitions & Events Australia',
  array['Collectables Festival','Trading Cards','Sports Memorabilia','Retro Gaming','Sydney','New South Wales','Darling Harbour','Comics']::text[],
  'https://collectfest.com.au/',
  'CollectFest Sydney 2027 — ICC Sydney, Darling Harbour',
  'CollectFest lands at ICC Sydney on 10–11 April 2027, 10am–5pm daily. Hundreds of traders, show-only exclusives and live activations across trading cards, sports memorabilia, retro gaming and toys.'
where not exists (
  select 1 from public.events where slug = 'collectfest-sydney-2027-04-10'
);

-- ── Pokémon Melbourne Regional Championships — Sat 29–Sun 30 May 2027, VIC ──
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type,
  'pending_review'::event_status,
  true,
  now(),
  'Pokémon Melbourne Regional Championships 2027',
  'pokemon-melbourne-regional-championships-2027-05-29',
  'Official Play! Pokémon Regional Championship at MCEC — the last of the three announced Australian Regionals of the 2027 season.',
  E'The Pokémon Melbourne Regional Championships are an official Play! Pokémon Regional-level event in the 2027 Championship Series season, held at the Melbourne Convention and Exhibition Centre.\n\nThe event awards Championship Points across the Trading Card Game and video game divisions, and is the last of the three announced Australian Regionals of the 2027 season — after Brisbane (September 2026) and Sydney (January 2027).\n\n[CardPop draft — found by an automated web sweep, not yet verified against the official page. Entry fees, session times and the registration open date are unannounced and left blank. Watch RK9 for the registration link.]',
  'Melbourne Convention and Exhibition Centre',
  '1 Convention Centre Place',
  'South Wharf',
  'VIC',
  '3006',
  '2027-05-29'::date,
  '2027-05-30'::date,
  false,
  true,
  'https://championships.pokemon.com/en-us/events/regionals/2027/melbourne',
  'The Pokémon Company International (Play! Pokémon)',
  array['Pokémon']::text[],
  array['Pokemon','Regional Championships','Play Pokemon','Tournament','Melbourne','Victoria','2027 Season']::text[],
  'https://championships.pokemon.com/en-us/events/regionals/2027/melbourne',
  'Pokémon Melbourne Regional Championships — May 2027, MCEC',
  'Official Play! Pokémon Regional Championships at the Melbourne Convention and Exhibition Centre, 29–30 May 2027. Championship Points across TCG and video game divisions for the 2027 season.'
where not exists (
  select 1 from public.events where slug = 'pokemon-melbourne-regional-championships-2027-05-29'
);
