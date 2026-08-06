-- Second batch of discovered Australian card events, drafted for human review.
--
-- Batch one (20260805212434) applied a deliberately high bar: two independent
-- sources agreeing, or a publisher's own season schedule. This batch lowers that
-- bar on request — the ask was "everything possible, I will verify" — so it
-- includes single-source and contested finds that batch one deliberately held
-- back. Everything still lands `pending_review` + `auto_discovered`, so nothing
-- reaches the public calendar without an admin approving it.
--
-- Because the bar is lower, the per-event verification notes matter more. Each
-- description ends with a bracketed note naming exactly what is unconfirmed, and
-- where two sources disagreed it names both readings. Delete that line when
-- approving. Fields nobody confirmed are still NULL rather than guessed.
--
-- HOW THE SUPANOVA 2027 DATES WERE RESOLVED
-- Sources contradicted each other on the whole 2027 circuit. The contradiction
-- turned out to be a one-row label shift in the 2027 date table: the readings
-- that place Brisbane in April all shift every subsequent city down one row.
-- The unshifted reading — Gold Coast 10-11 Apr, Melbourne 16-18 Apr, Sydney
-- 18-20 Jun, Perth 25-27 Jun — is the one used here, because it matches
-- Supanova's documented touring pattern (Melbourne and Gold Coast in autumn,
-- Sydney and Perth in June, Brisbane and Adelaide in November) and every date
-- falls on the weekday its format implies. Brisbane 2027 is NOT in April and is
-- not seeded at all: no November 2027 date has been published.
--
-- STILL NOT SEEDED — announced but genuinely undated. `events.start_date` is
-- NOT NULL, so these cannot be drafted without inventing a date, and inventing
-- one is worse than leaving them out. They are the watchlist:
--   Supanova Adelaide 2027 and Brisbane 2027; Oz Comic-Con Perth / Sydney /
--   Brisbane / Canberra 2027; PAX Aus 2027; One Piece Oceania Championship
--   Final (Winter 2027); Bandai's November 26-27 regionals (registration opens
--   23 Aug 2026); Yu-Gi-Oh Oceanic WCQ 2027 and OTS Championships; Disney
--   Lorcana Oceania 2026-27; Riftbound Oceania 2027; ANZ MTG cycles beyond #13;
--   Hunters Card Show (organiser advertises six 2026 dates, publishes one);
--   Blackout Card Show; The TCG Expo 2027; Trading Card Summit 2027; Kollecter
--   Kon; Cardcore 2027; CardCon 2027; Comic Gong 2027; AVCon 2027; SMASH! 2027.
--
-- Idempotent: each insert is skipped when its slug already exists.

-- ── Bandai Regional Weekend Sydney — Fri 7–Sun 9 Aug 2026, NSW ──────────────
-- Two days out at the time of writing. Review this one first.
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Bandai Regional Weekend Sydney 2026',
  'bandai-regional-weekend-sydney-2026-08-07',
  'A multi-game Bandai TCG regional weekend — Gundam, One Piece, Digimon and Dragon Ball Super competitive play across three days in Hurstville.',
  E'Let''s Play Games runs a multi-game Bandai regional weekend at the Alt. Events Centre in Hurstville, covering the Gundam Card Game, One Piece Card Game, Digimon Card Game and Dragon Ball Super Card Game.\n\nThe Gundam Card Game Oceania regional within the weekend is separately confirmed for Saturday 9 August and forms part of the World Championships 26-27 Regionals Season 2 circuit. Other Bandai titles run competitive and side events across the Friday-to-Sunday block.\n\n[CardPop draft — THIS EVENT IS IMMINENT, review it first. Found by an automated web sweep and not verified against the organiser''s page. The Gundam date (9 Aug) is corroborated; the full 7–9 Aug span came from a single source. Per-day schedule, which game runs when, and entry fees are all unconfirmed.]',
  'Alt. Events Centre', '2 Crofts Avenue', 'Hurstville', 'NSW', '2220',
  '2026-08-07'::date, '2026-08-09'::date, false, true,
  'https://events.humanitix.com/bandai-regional-weekend-sydney-2026',
  'https://events.humanitix.com/bandai-regional-weekend-sydney-2026',
  'Let''s Play Games',
  array['One Piece','Dragon Ball Super']::text[],
  array['Bandai','Gundam','One Piece','Digimon','Dragon Ball Super','Regional','Tournament','Sydney','Hurstville']::text[],
  'https://events.humanitix.com/bandai-regional-weekend-sydney-2026',
  'Bandai Regional Weekend Sydney — Gundam, One Piece, Digimon',
  'A multi-game Bandai TCG regional weekend at the Alt. Events Centre, Hurstville, 7–9 August 2026. Gundam, One Piece, Digimon and Dragon Ball Super competitive and side events.'
where not exists (select 1 from public.events where slug = 'bandai-regional-weekend-sydney-2026-08-07');

-- ── Hobby Kingdom Card Show — Sun 9 Aug 2026, NSW ───────────────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, is_free, registration_required,
  organizer_name, featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'pending_review'::event_status, true, now(),
  'Hobby Kingdom Card Show',
  'hobby-kingdom-card-show-2026-08-09',
  'A south-west Sydney card show at The Cube in Campbelltown, covering Pokémon, One Piece and sports cards.',
  E'A trading card show held at The Cube in Campbelltown, south-west Sydney, listed on the Australian card-show calendars for Sunday 9 August 2026.\n\nIt runs the same day as TCXPO at Oran Park, making for a busy south-west Sydney card weekend.\n\n[CardPop draft — the thinnest entry in this batch. Found only on aggregator calendars with no primary event page located, so times, entry fee, ticketing, vendor count and whether this is a one-off or a recurring series are all unknown. Verify the event exists before approving.]',
  'The Cube', '20-22 Camden Road', 'Campbelltown', 'NSW', '2560',
  '2026-08-09'::date, false, false,
  'Hobby Kingdom',
  array['Pokémon','One Piece']::text[],
  array['Card Show','Pokemon','Sports Cards','Campbelltown','South West Sydney','New South Wales']::text[],
  'https://www.tcgcalendar.com.au/',
  'Hobby Kingdom Card Show — Campbelltown, August 2026',
  'A trading card show at The Cube, Campbelltown on Sunday 9 August 2026. Pokémon, One Piece and sports cards in south-west Sydney.'
where not exists (select 1 from public.events where slug = 'hobby-kingdom-card-show-2026-08-09');

-- ── Pixel Expo 2026 — Sat 15–Sun 16 Aug 2026, WA ────────────────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, facebook_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Pixel Expo 2026',
  'pixel-expo-2026-08-15',
  'Perth''s gaming and pop-culture expo with a dedicated TCG floor — vendors, sellers, break companies and tournaments across the weekend.',
  E'Pixel Expo is Perth''s gaming and pop-culture expo, and it runs a dedicated trading card game floor alongside its exhibitor hall and video game zones.\n\nThe TCG space sits on level 2 in Meeting Rooms 1–3 and is open to vendors, sellers, break companies and tournaments across the whole weekend. Pixel Expo has run a TCG destination area for four consecutive years.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. Ticket prices, whether the TCG hall needs separate entry, the vendor list and the tournament schedule are all unconfirmed.]',
  'Perth Convention and Exhibition Centre', '21 Mounts Bay Road', 'Perth', 'WA', '6000',
  '2026-08-15'::date, '2026-08-16'::date, '09:00'::time, '17:00'::time, false, false,
  'https://www.pixelexpo.org.au/', 'https://www.simpletix.com/e/pixel-expo-2026-tickets-253678',
  'https://www.facebook.com/pixelexpo/', 'Pixel Expo',
  array['Pokémon','Magic: The Gathering','Yu-Gi-Oh!','One Piece']::text[],
  array['Gaming Expo','TCG','Perth','Western Australia','Tournaments','Vendors','Pop Culture']::text[],
  'https://www.pixelexpo.org.au/trading-card-games',
  'Pixel Expo 2026 — Perth Gaming Expo with a Dedicated TCG Floor',
  'Pixel Expo returns to the Perth Convention and Exhibition Centre on 15–16 August 2026 with a dedicated trading card game floor — vendors, break companies and tournaments across the weekend.'
where not exists (select 1 from public.events where slug = 'pixel-expo-2026-08-15');

-- ── Collector's Paradise Gold Coast — Sat 15 Aug 2026, QLD ──────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, is_free, entry_fee_aud, registration_required,
  website_url, ticket_url, instagram_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'pending_review'::event_status, true, now(),
  'Collector''s Paradise Gold Coast',
  'collectors-paradise-gold-coast-2026-08-15',
  'A Gold Coast buy/sell/trade card show — Pokémon, One Piece and Dragon Ball vendors plus artist stalls, accessories and giveaways.',
  E'Collector''s Paradise runs recurring trading card and collectibles shows across Melbourne and the Gold Coast, billed as a family-friendly buy, sell and trade day.\n\nThe Gold Coast editions rotate between PCYC Nerang and PCYC Ashmore, with Pokémon, One Piece and Dragon Ball vendors selling singles, sealed product, slabs and collectibles, plus artist stalls, accessories, food and giveaways.\n\n[CardPop draft — VENUE IS CONTESTED. One source places 15 August at PCYC Nerang (61 Cayuga Street) and another at PCYC Ashmore (44 Dominions Road) — they may even be two separate shows. PCYC Nerang is recorded here because the TryBooking listing points there. Confirm which venue before approving. Times are unconfirmed, and the $20 VIP / $10 general pricing is carried over from the June edition, not confirmed for this date.]',
  'PCYC Nerang', '61 Cayuga Street', 'Nerang', 'QLD', '4211',
  '2026-08-15'::date, false, 10, false,
  'https://www.collectorsparadise.au/', 'https://www.trybooking.com/events/landing/1578181',
  'https://www.instagram.com/collectorsparadise25/', 'Collector''s Paradise',
  array['Pokémon','One Piece','Dragon Ball Super']::text[],
  array['Card Show','Gold Coast','Queensland','Pokemon','Buy Sell Trade','PCYC']::text[],
  'https://www.trybooking.com/events/landing/1578181',
  'Collector''s Paradise Gold Coast — Card Show, August 2026',
  'Collector''s Paradise brings its buy, sell and trade card show to the Gold Coast on Saturday 15 August 2026. Pokémon, One Piece and Dragon Ball vendors, artist stalls and giveaways.'
where not exists (select 1 from public.events where slug = 'collectors-paradise-gold-coast-2026-08-15');

-- ── Sydney Trading Card Show – Hurstville — Sat 15–Sun 16 Aug 2026, NSW ─────
-- Two agents surfaced this separately (once as "Sydney Trading Card Show", once
-- as the Sydney leg of the Trading Card Show Australia circuit) but both point
-- at the same TryBooking listing, so it is seeded once.
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, instagram_url, facebook_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'pending_review'::event_status, true, now(),
  'Sydney Trading Card Show – Hurstville',
  'sydney-trading-card-show-hurstville-2026-08-15',
  'Two days of TCG singles, sealed, sports cards and graded slabs in the auditorium at Club Central Hurstville.',
  E'A two-day trading card show in the auditorium at Club Central Hurstville, in Sydney''s south, run as the Sydney leg of the Trading Card Show Australia circuit.\n\nVendors cover TCG singles and sealed product, sports cards across NBA, NRL, AFL and soccer, graded slabs and accessories. Doors run 9:00am to 4:00pm on both days.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. Entry pricing and ticket tiers were not published anywhere the sweep could reach. The two-day span comes from the TryBooking listing title rather than a schedule.]',
  'The Auditorium, Club Central Hurstville', '2 Crofts Avenue', 'Hurstville', 'NSW', '2220',
  '2026-08-15'::date, '2026-08-16'::date, '09:00'::time, '16:00'::time, false, false,
  'https://tradingcardshowaus.com.au/', 'https://www.trybooking.com/events/landing/1546197',
  'https://www.instagram.com/tradingcardshow_australia/',
  'https://www.facebook.com/p/Trading-Card-Show-Australia-61566246814589/',
  'Trading Card Show Australia',
  array['Pokémon','One Piece','Yu-Gi-Oh!','Magic: The Gathering']::text[],
  array['Card Show','Sports Cards','Graded Cards','Sydney','Hurstville','New South Wales']::text[],
  'https://www.trybooking.com/events/landing/1546197',
  'Sydney Trading Card Show — Club Central Hurstville, Aug 2026',
  'A two-day trading card show at Club Central Hurstville on 15–16 August 2026, 9am–4pm daily. TCG singles and sealed, sports cards, graded slabs and accessories.'
where not exists (select 1 from public.events where slug = 'sydney-trading-card-show-hurstville-2026-08-15');

-- ── Shell Con Mania 2 — Sat 22 Aug 2026, NSW ────────────────────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, suburb, state, postcode,
  start_date, start_time, end_time, is_free, registration_required,
  website_url, featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'pending_review'::event_status, true, now(),
  'Shell Con Mania 2',
  'shell-con-mania-2-2026-08-22',
  'A pop-culture and trading card event in the Illawarra — one of the few card shows serving Shellharbour and the south coast.',
  E'The second Shell Con Mania, a pop-culture and trading card event at Shellharbour City Stadium in the Illawarra.\n\nIt appears on vendor circuits for August 2026, which suggests a genuine card-vendor floor rather than a purely comic-focused convention. Shellharbour is a regional Illawarra location the major show circuits otherwise skip.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. The full street address, entry fee, organiser name, ticketing link and the balance of trading cards versus general pop culture are all unconfirmed.]',
  'Shellharbour City Stadium', 'Shellharbour', 'NSW', '2529',
  '2026-08-22'::date, '10:00'::time, '17:00'::time, false, false,
  'https://www.visitshellharbour.com.au/whats-on/shell-con-mania-2-at-shellharbour-city-stadium/',
  array['Pokémon']::text[],
  array['Card Show','Pop Culture','Sports Cards','Shellharbour','Illawarra','New South Wales']::text[],
  'https://www.visitshellharbour.com.au/whats-on/shell-con-mania-2-at-shellharbour-city-stadium/',
  'Shell Con Mania 2 — Shellharbour Card & Pop Culture Event',
  'Shell Con Mania returns to Shellharbour City Stadium on Saturday 22 August 2026, 10am–5pm. Trading cards and pop culture in the Illawarra.'
where not exists (select 1 from public.events where slug = 'shell-con-mania-2-2026-08-22');

-- ── Big Boyz Card Show – Seven Hills (August) — Sun 23 Aug 2026, NSW ────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, is_free, registration_required,
  website_url, facebook_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'pending_review'::event_status, true, now(),
  'Big Boyz Card Show – Seven Hills (August)',
  'big-boyz-card-show-seven-hills-august-2026',
  'The August date in NSW''s most frequent card-show series, at its flagship Hudson Hotel venue in Seven Hills.',
  E'Big Boyz Card Show is NSW''s most frequent card show series, running roughly every four to six weeks with the Hudson Hotel in Seven Hills as its flagship venue.\n\nThe floor is card-dominated — TCG singles, sports cards and graded slabs — rather than general pop-culture merchandise. Tickets are sold through Sticky Tickets.\n\n[CardPop draft — found by an automated web sweep. No dedicated ticket page for this specific date was located, so the date rests on aggregator calendars rather than an organiser listing. Times and pricing are unconfirmed; earlier Hudson Hotel editions ran roughly 9:00am–4:00pm. Confirm on the organiser''s Facebook page before approving.]',
  'Hudson Hotel', '5 Quinn Avenue', 'Seven Hills', 'NSW', '2147',
  '2026-08-23'::date, false, false,
  'https://www.bigboyzgroup.com/card-shows',
  'https://www.facebook.com/p/Big-Boyz-Card-Show-61574125569763/',
  'Big Boyz Group',
  array['Pokémon','One Piece','Magic: The Gathering','Yu-Gi-Oh!']::text[],
  array['Card Show','Sports Cards','Graded Cards','Seven Hills','Western Sydney','New South Wales']::text[],
  'https://phoenyxcurios.com.au/pages/event-calendar',
  'Big Boyz Card Show Seven Hills — August 2026',
  'The Big Boyz Card Show returns to the Hudson Hotel, Seven Hills on Sunday 23 August 2026. TCG singles, sports cards and graded slabs in western Sydney.'
where not exists (select 1 from public.events where slug = 'big-boyz-card-show-seven-hills-august-2026');

-- ── Dragonite Cards & Collectables Expo — Sun 23 Aug 2026, NSW ──────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, registration_required,
  ticket_url, organizer_name, featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'pending_review'::event_status, true, now(),
  'Dragonite Cards & Collectables Expo',
  'dragonite-cards-collectables-expo-2026-08-23',
  'A western Sydney cards and collectables expo — Pokémon and sports cards alongside Funko Pops, comics and vintage toys.',
  E'A cards and collectables expo at the St Marys Band Club in western Sydney.\n\nThe floor mixes Pokémon and sports cards with Funko Pops, comics, vintage toys and gaming collectibles, so it sits closer to a hybrid collector fair than a pure TCG show. Tickets are sold through Humanitix.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. Entry price is unconfirmed and the organiser name is inferred from the event title.]',
  'St Marys Band Club', '411 Great Western Highway', 'St Marys', 'NSW', '2760',
  '2026-08-23'::date, '10:00'::time, '17:00'::time, false, false,
  'https://events.humanitix.com/dragonite-cards-and-collectables-expo',
  'Dragonite Cards & Collectables',
  array['Pokémon']::text[],
  array['Card Show','Collectables','Pokemon','Sports Cards','St Marys','Western Sydney','Funko']::text[],
  'https://events.humanitix.com/dragonite-cards-and-collectables-expo',
  'Dragonite Cards & Collectables Expo — St Marys, August 2026',
  'A cards and collectables expo at the St Marys Band Club on Sunday 23 August 2026, 10am–5pm. Pokémon, sports cards, Funko Pops, comics and vintage toys.'
where not exists (select 1 from public.events where slug = 'dragonite-cards-collectables-expo-2026-08-23');

-- ── Magic Spotlight: The Hobbit — Fri 28–Sun 30 Aug 2026, QLD ──────────────
-- The first Spotlight Series event in Australia/NZ, and the best-sourced entry
-- in either batch. Batch one missed it only because it fell a week outside the
-- window that sweep was given.
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, is_free, entry_fee_aud, registration_required,
  website_url, ticket_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Magic Spotlight: The Hobbit — Brisbane',
  'magic-spotlight-the-hobbit-brisbane-2026-08-28',
  'The first Magic Spotlight Series event in Australia — US$50,000 Modern Constructed main event at BCEC. Free entry to the floor.',
  E'Magic Spotlight: The Hobbit comes to the Brisbane Convention & Exhibition Centre, the first Spotlight Series event held in Australia or New Zealand and one of the biggest Magic events ever run here.\n\nThe Modern Constructed main event carries a US$50,000 prize pool and runs on Saturday, with a player meeting at 9:30am and round one at 10:00am — nine rounds of Swiss on day one, with 18-plus match points advancing to day two for six more rounds and a Top 8 cut.\n\nEntry to the event floor is free; tickets are only needed to play. The main event is A$120, and a CommandZone Pass is A$120 for full weekend Commander access plus a non-foil promo and six game tokens. Doors open 9:00am Friday and Saturday, 8:30am Sunday. Artists, vendors and side events run all weekend.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page, though it is the best-corroborated event in this batch. One source rendered the venue as the Brisbane Convention & "Entertainment" Centre; the Grey Street address points to the Convention & Exhibition Centre. Confirm before approving.]',
  'Brisbane Convention & Exhibition Centre', 'Grey Street', 'South Brisbane', 'QLD', '4101',
  '2026-08-28'::date, '2026-08-30'::date, '09:00'::time, true, 0, true,
  'https://magic.gg/spotlight',
  'https://events.humanitix.com/magic-spotlight-the-hobbit-tm-brisbane',
  'Let''s Play Games',
  array['Magic: The Gathering']::text[],
  array['Magic The Gathering','Spotlight Series','Modern','Tournament','Brisbane','Queensland','The Hobbit','Commander']::text[],
  'https://magic.gg/news/prepare-for-magic-spotlight-the-hobbit-in-brisbane-and-dallas',
  'Magic Spotlight: The Hobbit Brisbane — US$50,000 Modern Event',
  'The first Magic Spotlight Series event in Australia lands at BCEC, 28–30 August 2026. US$50,000 Modern Constructed main event, CommandZone, artists and vendors. Free entry to the floor.'
where not exists (select 1 from public.events where slug = 'magic-spotlight-the-hobbit-brisbane-2026-08-28');

-- ── Animaga Expo Melbourne — Sat 29–Sun 30 Aug 2026, VIC ────────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Animaga Expo Melbourne 2026',
  'animaga-expo-melbourne-2026-08-29',
  'Melbourne''s anime, manga and gaming expo at MCEC, with Japanese TCG vendors and play space on the exhibitor floor.',
  E'Animaga is Melbourne''s anime, manga and gaming expo, held at the Melbourne Convention and Exhibition Centre.\n\nThe exhibitor hall carries anime goods and collectibles, artist alley, interactive gaming zones and cosplay competitions, with Japanese TCG vendors and play space a standing part of the floor.\n\nIt runs the same weekend as Card Fest Melbourne, so vendor overlap between the two is likely.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. Whether there is a formally dedicated TCG hall or tournaments — as opposed to card vendors within the general exhibitor hall — is unconfirmed, as are ticket prices and opening hours.]',
  'Melbourne Convention and Exhibition Centre', '1 Convention Centre Place', 'South Wharf', 'VIC', '3006',
  '2026-08-29'::date, '2026-08-30'::date, false, false,
  'https://animaga.com.au/animaga-melbourne-2026/', 'https://events.humanitix.com/animaga-melbourne',
  'Animaga',
  array['Pokémon','One Piece','Yu-Gi-Oh!']::text[],
  array['Anime Expo','Manga','TCG','Melbourne','Victoria','Cosplay','Weiss Schwarz']::text[],
  'https://animaga.com.au/animaga-melbourne-2026/',
  'Animaga Expo Melbourne 2026 — Anime, Manga & TCG at MCEC',
  'Animaga returns to the Melbourne Convention and Exhibition Centre on 29–30 August 2026. Anime and manga exhibitors, artist alley, cosplay and Japanese TCG vendors.'
where not exists (select 1 from public.events where slug = 'animaga-expo-melbourne-2026-08-29');

-- ── Collectorama Fair – Nambour (September) — Sat 5 Sep 2026, QLD ───────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, entry_fee_aud, registration_required,
  instagram_url, facebook_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Collectorama Fair – Nambour (September)',
  'collectorama-fair-nambour-september-2026',
  'A Sunshine Coast collectables fair with around 150 traders — antiques, vintage and collectables, with card and memorabilia dealers among them.',
  E'Collectorama is a long-running Sunshine Coast collectables fair at the Nambour Showgrounds, running several times a year with around 150 traders.\n\nIt is a general antiques-and-collectables market rather than a dedicated trading card show, though card and memorabilia dealers do attend. Entry is $8 cash per person with children 12 and under free, plus free parking and food trucks on site.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. The 2026 date set was reported inconsistently across sources, so confirm 5 September before approving. This is arguably not a card show and may not belong on a card-focused calendar at all — worth a judgement call.]',
  'Nambour Showgrounds', '80 Coronation Avenue', 'Nambour', 'QLD', '4560',
  '2026-09-05'::date, '07:00'::time, '14:00'::time, false, 8, false,
  'https://www.instagram.com/collectoramafair/', 'https://www.facebook.com/CollectoramaFair/',
  'Collectorama Fair',
  array['Collectables','Antiques','Sunshine Coast','Queensland','Memorabilia','Market']::text[],
  'https://www.weekendnotes.com/collectorama-fair-nambour-2026/',
  'Collectorama Fair Nambour — Sunshine Coast Collectables, Sept 2026',
  'Collectorama returns to the Nambour Showgrounds on Saturday 5 September 2026, 7am–2pm. Around 150 traders of antiques, vintage and collectables. $8 entry, kids 12 and under free.'
where not exists (select 1 from public.events where slug = 'collectorama-fair-nambour-september-2026');

-- ── One Piece Card Game — Brisbane September Regional — Sat 5 Sep 2026, QLD ─
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'lgs_event'::event_type, 'pending_review'::event_status, true, now(),
  'One Piece Card Game — Brisbane September Regional',
  'one-piece-card-game-brisbane-september-regional-2026',
  'A Bandai-sanctioned Oceania regional championship for the One Piece Card Game at BCEC, feeding the Oceania Championship Final.',
  E'A Bandai-sanctioned Oceania regional championship for the One Piece Card Game at the Brisbane Convention & Exhibition Centre, run by TAK Games.\n\nFormat is constructed Swiss, best-of-one, with 30 minutes per round plus five minutes of extra time. Wristband distribution begins at 8:00am with venue entry from 8:45am. Winners progress toward the Oceania Championship Final.\n\n[CardPop draft — THE DATE IS CONTESTED. One source gives Saturday 5 September and another gives Saturday 12 September for the same event title. 5 September is recorded here because the companion Treasure Cup consistently runs the day after and was listed for the 6th. Confirm on Humanitix before approving. Entry fee and player cap are unconfirmed.]',
  'Brisbane Convention & Exhibition Centre', 'Grey Street', 'South Brisbane', 'QLD', '4101',
  '2026-09-05'::date, '08:45'::time, false, true,
  'https://en.onepiece-cardgame.com/events/',
  'https://events.humanitix.com/one-piece-card-game-championship-2026-brisbane-september-regional-oceania',
  'TAK Games',
  array['One Piece']::text[],
  array['One Piece','Bandai','Regional','Tournament','Brisbane','Queensland','Oceania']::text[],
  'https://events.humanitix.com/one-piece-card-game-championship-2026-brisbane-september-regional-oceania',
  'One Piece Card Game Brisbane Regional — September 2026',
  'A Bandai Oceania regional championship for the One Piece Card Game at BCEC, Brisbane. Constructed Swiss, best-of-one, feeding the Oceania Championship Final.'
where not exists (select 1 from public.events where slug = 'one-piece-card-game-brisbane-september-regional-2026');

-- ── One Piece Card Game — Brisbane September Treasure Cup — Sun 6 Sep 2026 ──
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'lgs_event'::event_type, 'pending_review'::event_status, true, now(),
  'One Piece Card Game — Brisbane September Treasure Cup',
  'one-piece-card-game-brisbane-september-treasure-cup-2026',
  'The lower-barrier companion event to the Brisbane regional — constructed Swiss, no top cut, the day after.',
  E'The Treasure Cup side event runs the day after the Brisbane September Regional at the same venue.\n\nTreasure Cups are constructed Swiss events with no top cut, best-of-one, 30 minutes per round plus five minutes of extra time, with electronic decklist submission through TCG+. They are the lower-barrier companion to the regional.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. Start and end times, entry fee and player cap are unconfirmed, and the date is tied to the contested regional date — if the regional moves to 12 September, this moves to the 13th.]',
  'Brisbane Convention & Exhibition Centre', 'Grey Street', 'South Brisbane', 'QLD', '4101',
  '2026-09-06'::date, false, true,
  'https://en.onepiece-cardgame.com/events/',
  'https://events.humanitix.com/one-piece-card-game-2026-brisbane-september-treasure-cup-oceania',
  'TAK Games',
  array['One Piece']::text[],
  array['One Piece','Bandai','Treasure Cup','Tournament','Brisbane','Queensland','Oceania']::text[],
  'https://events.humanitix.com/one-piece-card-game-2026-brisbane-september-treasure-cup-oceania',
  'One Piece Treasure Cup Brisbane — September 2026',
  'The One Piece Card Game Treasure Cup at BCEC, Brisbane, the day after the September regional. Constructed Swiss, no top cut, best-of-one.'
where not exists (select 1 from public.events where slug = 'one-piece-card-game-brisbane-september-treasure-cup-2026');

-- ── Gundam Card Game — Melbourne September Regional — Sat 12 Sep 2026, VIC ──
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'lgs_event'::event_type, 'pending_review'::event_status, true, now(),
  'Gundam Card Game — Melbourne September Regional Championship',
  'gundam-card-game-melbourne-september-regional-2026',
  'An Oceania regional for the Gundam Card Game at Marvel Stadium, part of the World Championships 26-27 Regionals Season 2 circuit.',
  E'An Oceania regional championship for the Gundam Card Game at the Marvel Stadium function venues in Docklands, part of the World Championships 26-27 Regionals Season 2 circuit.\n\nConstructed Swiss with no top cut, best-of-one, 35 minutes per round. Tickets are restricted at launch to Oceania residents and citizens — non-resident purchases are refunded and those players waitlisted until one week before the event. Side events run on the Sunday.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. The direct Humanitix listing for this specific September date was not located, and entry fee and player cap are unconfirmed. This is a different event from the Gundam Melbourne regional already on the calendar for July 2026.]',
  'Marvel Stadium Function Venues', '740 Bourke Street', 'Docklands', 'VIC', '3008',
  '2026-09-12'::date, '13:00'::time, '17:30'::time, false, true,
  'https://www.gundam-gcg.com/en/events/CS26-27Regionals_2.html',
  'https://events.humanitix.com/host/tak-games', 'TAK Games',
  array['Gundam Card Game','Bandai','Regional','Tournament','Melbourne','Victoria','Oceania']::text[],
  'https://www.gundam-gcg.com/en/events/CS26-27Regionals_2.html',
  'Gundam Card Game Melbourne Regional — September 2026',
  'An Oceania regional championship for the Gundam Card Game at Marvel Stadium, Docklands on Saturday 12 September 2026. Constructed Swiss, best-of-one, 35 minutes per round.'
where not exists (select 1 from public.events where slug = 'gundam-card-game-melbourne-september-regional-2026');

-- ── Digimon Card Game — Melbourne September Regional — Sun 13 Sep 2026, VIC ─
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'lgs_event'::event_type, 'pending_review'::event_status, true, now(),
  'Digimon Card Game — Melbourne September Regional',
  'digimon-card-game-melbourne-september-regional-2026',
  'An Oceania Digimon regional at Marvel Stadium, sharing the weekend with the Gundam and Dragon Ball Super regionals.',
  E'An Oceania regional for the Digimon Card Game under the World Championship 26-27 Regionals Season 2 banner, sharing the Marvel Stadium function venue with the Gundam and Dragon Ball Super regionals across the same weekend.\n\nDigimon regionals run constructed Swiss with no top cut, best-of-three matches at 45 minutes per round. An Ultimate Cup side event typically accompanies the regional.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. The direct Humanitix listing, entry fee, player cap, and whether an Ultimate Cup runs alongside are all unconfirmed.]',
  'Marvel Stadium Function Venues', '740 Bourke Street', 'Docklands', 'VIC', '3008',
  '2026-09-13'::date, '09:30'::time, '17:30'::time, false, true,
  'https://world.digimoncard.com/event/2026/championship/regionals-season2/',
  'https://events.humanitix.com/host/tak-games', 'TAK Games',
  array['Digimon Card Game','Bandai','Regional','Tournament','Melbourne','Victoria','Oceania']::text[],
  'https://world.digimoncard.com/event/2026/championship/regionals-season2/',
  'Digimon Card Game Melbourne Regional — September 2026',
  'An Oceania Digimon Card Game regional at Marvel Stadium, Docklands on Sunday 13 September 2026. Constructed Swiss, best-of-three, 45 minutes per round.'
where not exists (select 1 from public.events where slug = 'digimon-card-game-melbourne-september-regional-2026');

-- ── Dragon Ball Super MASTERS — Melbourne Regional — Sun 13 Sep 2026, VIC ───
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'lgs_event'::event_type, 'pending_review'::event_status, true, now(),
  'Dragon Ball Super Card Game MASTERS — Melbourne Regional Championship',
  'dragon-ball-super-masters-melbourne-regional-2026',
  'An Oceania Masters regional at Marvel Stadium, running concurrently with the Digimon regional in a Bandai multi-game weekend.',
  E'An Oceania regional championship for Dragon Ball Super Card Game Masters, part of the Masters Championship 26-27 season.\n\nConstructed Swiss, no top cut, best-of-one with 35 minutes per round. It runs concurrently with the Digimon regional at the same Marvel Stadium function venue, forming a Bandai multi-game weekend in Melbourne.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. The Humanitix listing found points at an earlier 2026 Melbourne regional rather than this September date. Entry fee, player cap and whether a Fusion World event runs alongside Masters are unconfirmed.]',
  'Marvel Stadium Function Venues', '740 Bourke Street', 'Docklands', 'VIC', '3008',
  '2026-09-13'::date, '09:00'::time, '17:00'::time, false, true,
  'https://www.dbs-cardgame.com/event/exhibition-event/championship2026/regionals_wave1/',
  'https://events.humanitix.com/host/tak-games', 'TAK Games',
  array['Dragon Ball Super']::text[],
  array['Dragon Ball Super','Masters','Bandai','Regional','Tournament','Melbourne','Victoria','Oceania']::text[],
  'https://www.dbs-cardgame.com/event/exhibition-event/championship2026/regionals_wave1/',
  'Dragon Ball Super Masters Melbourne Regional — Sept 2026',
  'An Oceania Dragon Ball Super Card Game Masters regional at Marvel Stadium, Docklands on Sunday 13 September 2026. Constructed Swiss, best-of-one, 35 minutes per round.'
where not exists (select 1 from public.events where slug = 'dragon-ball-super-masters-melbourne-regional-2026');

-- ── Big Boyz Card Show – Seven Hills (September) — Sun 20 Sep 2026, NSW ─────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, is_free, registration_required,
  website_url, facebook_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'pending_review'::event_status, true, now(),
  'Big Boyz Card Show – Seven Hills (September)',
  'big-boyz-card-show-seven-hills-september-2026',
  'The September instalment of the Big Boyz series at the Hudson Hotel — TCG singles, sports cards and graded slabs.',
  E'The September instalment of the Big Boyz Card Show series at its flagship Hudson Hotel venue in Seven Hills.\n\nThe series runs on a roughly four-to-six week cycle and is card-focused: TCG singles, sports cards and graded slabs rather than general pop-culture merchandise. Tickets are sold via Sticky Tickets.\n\n[CardPop draft — found by an automated web sweep. The date appears on two aggregator calendars but no organiser or ticketing page for this specific date was located. Times and pricing are unconfirmed. Confirm on the organiser''s Facebook page before approving.]',
  'Hudson Hotel', '5 Quinn Avenue', 'Seven Hills', 'NSW', '2147',
  '2026-09-20'::date, false, false,
  'https://www.bigboyzgroup.com/card-shows',
  'https://www.facebook.com/p/Big-Boyz-Card-Show-61574125569763/',
  'Big Boyz Group',
  array['Pokémon','One Piece','Magic: The Gathering','Yu-Gi-Oh!']::text[],
  array['Card Show','Sports Cards','Graded Cards','Seven Hills','Western Sydney','New South Wales']::text[],
  'https://phoenyxcurios.com.au/pages/event-calendar',
  'Big Boyz Card Show Seven Hills — September 2026',
  'The Big Boyz Card Show returns to the Hudson Hotel, Seven Hills on Sunday 20 September 2026. TCG singles, sports cards and graded slabs in western Sydney.'
where not exists (select 1 from public.events where slug = 'big-boyz-card-show-seven-hills-september-2026');

-- ── MNK Card Kingdom Expo Brisbane — Sun 18 Oct 2026, QLD ───────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, registration_required,
  website_url, organizer_name, featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'pending_review'::event_status, true, now(),
  'MNK Card Kingdom Expo Brisbane',
  'mnk-card-kingdom-expo-brisbane-2026-10-18',
  'A trading card expo at the Royal International Convention Centre run by Brisbane retailer MNK Card Kingdom.',
  E'A trading card expo run by Brisbane retailer MNK Card Kingdom at the Royal International Convention Centre, Brisbane Showgrounds, listed on the retailer''s own shows and expos page.\n\n[CardPop draft — CHECK FOR DUPLICATION FIRST. The calendar already carries "Brisbane Trading Card Show" on this same date at this same venue. These may well be the same event listed under a vendor''s name, in which case reject this one. If they are genuinely distinct, entry fee, ticketing, vendor count and the featured game mix are all still unconfirmed.]',
  'Royal International Convention Centre', '600 Gregory Terrace', 'Bowen Hills', 'QLD', '4006',
  '2026-10-18'::date, '10:00'::time, '16:00'::time, false, false,
  'https://www.mnkcardkingdom.com.au/pages/events', 'MNK Card Kingdom',
  array['Pokémon','One Piece']::text[],
  array['Card Show','Pokemon','Sports Cards','Brisbane','Bowen Hills','Queensland']::text[],
  'https://www.mnkcardkingdom.com.au/pages/events',
  'MNK Card Kingdom Expo — Brisbane, October 2026',
  'A trading card expo at the Royal International Convention Centre, Bowen Hills on Sunday 18 October 2026, 10am–4pm. Pokémon, One Piece and sports cards.'
where not exists (select 1 from public.events where slug = 'mnk-card-kingdom-expo-brisbane-2026-10-18');

-- ── Collectorama Fair – Nambour (November) — Sat 14 Nov 2026, QLD ───────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, entry_fee_aud, registration_required,
  instagram_url, facebook_url, organizer_name,
  tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Collectorama Fair – Nambour (November)',
  'collectorama-fair-nambour-november-2026',
  'The final 2026 Collectorama on the Sunshine Coast — around 150 traders of antiques, vintage and collectables.',
  E'The final 2026 Collectorama Fair at the Nambour Showgrounds on the Sunshine Coast.\n\nAround 150 traders sell antiques, vintage items and collectables, with card and memorabilia dealers among them. Entry is $8 cash with children 12 and under free, plus free parking, food trucks and on-site ATMs.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. As with the September date, the 2026 date set was reported inconsistently, so confirm 14 November before approving. Not a dedicated card show.]',
  'Nambour Showgrounds', '80 Coronation Avenue', 'Nambour', 'QLD', '4560',
  '2026-11-14'::date, '07:00'::time, '14:00'::time, false, 8, false,
  'https://www.instagram.com/collectoramafair/', 'https://www.facebook.com/CollectoramaFair/',
  'Collectorama Fair',
  array['Collectables','Antiques','Sunshine Coast','Queensland','Memorabilia','Market']::text[],
  'https://www.weekendnotes.com/collectorama-fair-nambour-2026/',
  'Collectorama Fair Nambour — November 2026',
  'The final 2026 Collectorama at the Nambour Showgrounds on Saturday 14 November, 7am–2pm. Around 150 traders of antiques, vintage and collectables. $8 entry, kids 12 and under free.'
where not exists (select 1 from public.events where slug = 'collectorama-fair-nambour-november-2026');

-- ── Flesh and Blood — The Calling: Sydney — Sat 14–Sun 15 Nov 2026, NSW ─────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, is_free, entry_fee_aud, capacity, registration_required,
  website_url, ticket_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'lgs_event'::event_type, 'pending_review'::event_status, true, now(),
  'Flesh and Blood — The Calling: Sydney',
  'flesh-and-blood-the-calling-sydney-2026-11-14',
  'A World Tour Calling event — open entry, no invitation needed, capped at 250 players. Classic Constructed, $120 entry.',
  E'A World Tour Calling event for Flesh and Blood at Club Central Hurstville — open entry with no invitation required, capped at 250 players.\n\nFormat is Classic Constructed with both days starting at 9:00am and a $120 entry. Additional public events run 13–15 November, and the main event is livestreamed on the official Flesh and Blood YouTube channel. A Battle Hardened runs on the Sunday, letting players test the new Classic Constructed metagame.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page, though it is one of the better-sourced entries here. Whether the 13 November public events are ticketed separately, and their pricing, is unconfirmed.]',
  'Club Central Hurstville', '2 Crofts Avenue', 'Hurstville', 'NSW', '2220',
  '2026-11-14'::date, '2026-11-15'::date, '09:00'::time, false, 120, 250, true,
  'https://fabtcg.com/organised-play/2026/calling-sydney-2/',
  'https://events.humanitix.com/flesh-and-blood-the-calling-sydney-november-2026',
  'Legend Story Studios / Let''s Play Games',
  array['Flesh and Blood']::text[],
  array['Flesh and Blood','The Calling','World Tour','Classic Constructed','Tournament','Sydney','Hurstville']::text[],
  'https://fabtcg.com/organised-play/2026/calling-sydney-2/',
  'Flesh and Blood The Calling: Sydney — November 2026',
  'A Flesh and Blood World Tour Calling at Club Central Hurstville, 14–15 November 2026. Classic Constructed, open entry, 250-player cap, $120. Battle Hardened on the Sunday.'
where not exists (select 1 from public.events where slug = 'flesh-and-blood-the-calling-sydney-2026-11-14');

-- ── Big Boyz Card Show – Bella Vista — Sun 15 Nov 2026, NSW ─────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, suburb, state, postcode,
  start_date, is_free, registration_required,
  website_url, facebook_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'pending_review'::event_status, true, now(),
  'Big Boyz Card Show – Bella Vista',
  'big-boyz-card-show-bella-vista-november-2026',
  'The Big Boyz circuit moves to the Bella Vista Hotel in Sydney''s Hills District.',
  E'The November Big Boyz Card Show moves to the Bella Vista Hotel in Sydney''s Hills District.\n\nAs with the rest of the series, the floor is card-dominated — TCG singles, sports cards and graded slabs — rather than general pop-culture merchandise. Tickets through Sticky Tickets.\n\n[CardPop draft — found by an automated web sweep. Street address, postcode, times and pricing are all unconfirmed, and the date appears on aggregator calendars only, with no organiser listing located. Confirm on the organiser''s Facebook page before approving.]',
  'Bella Vista Hotel', 'Bella Vista', 'NSW', '2153',
  '2026-11-15'::date, false, false,
  'https://www.bigboyzgroup.com/card-shows',
  'https://www.facebook.com/p/Big-Boyz-Card-Show-61574125569763/',
  'Big Boyz Group',
  array['Pokémon','One Piece','Magic: The Gathering','Yu-Gi-Oh!']::text[],
  array['Card Show','Sports Cards','Graded Cards','Bella Vista','Hills District','Sydney','New South Wales']::text[],
  'https://phoenyxcurios.com.au/pages/event-calendar',
  'Big Boyz Card Show Bella Vista — November 2026',
  'The Big Boyz Card Show comes to the Bella Vista Hotel in Sydney''s Hills District on Sunday 15 November 2026. TCG singles, sports cards and graded slabs.'
where not exists (select 1 from public.events where slug = 'big-boyz-card-show-bella-vista-november-2026');

-- ── Oz Comic-Con Melbourne Xmas Edition — Sat 5–Sun 6 Dec 2026, VIC ─────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, organizer_name, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Oz Comic-Con Melbourne — Xmas Edition 2026',
  'oz-comic-con-melbourne-xmas-edition-2026-12-05',
  'A second, Christmas-themed Melbourne Oz Comic-Con at MCEC, separate from the main June show.',
  E'A second, Christmas-themed Melbourne edition of Oz Comic-Con at the Melbourne Convention and Exhibition Centre, separate from the main June Melbourne show.\n\nTrading card vendors form part of the exhibitor floor alongside comics, anime, cosplay and guest signings.\n\n[CardPop draft — one of the weakest dates in this batch. The Xmas Edition is confirmed to exist by several sources, but the 5–6 December dates come from a single aggregator and did not appear on the official Oz Comic-Con Melbourne page. Ticket prices and the venue for the Xmas edition specifically are also unconfirmed. Verify before approving.]',
  'Melbourne Convention and Exhibition Centre', '1 Convention Centre Place', 'South Wharf', 'VIC', '3006',
  '2026-12-05'::date, '2026-12-06'::date, false, false,
  'https://ozcomiccon.com/melbourne/', 'Oz Comic-Con',
  array['Comic Con','Pop Culture','Collectables','Trading Cards','Melbourne','Victoria','Christmas']::text[],
  'https://ozcomiccon.com/melbourne/',
  'Oz Comic-Con Melbourne Xmas Edition — December 2026',
  'A Christmas edition of Oz Comic-Con at the Melbourne Convention and Exhibition Centre, 5–6 December 2026. Comics, anime, cosplay and trading card vendors.'
where not exists (select 1 from public.events where slug = 'oz-comic-con-melbourne-xmas-edition-2026-12-05');

-- ── The Game Expo (TGX) 2027 — Sat 3–Sun 4 Apr 2027, VIC ───────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  state, start_date, end_date, is_free, registration_required,
  website_url, organizer_name, featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'The Game Expo (TGX) 2027',
  'the-game-expo-tgx-2027-04-03',
  'A Melbourne gaming convention with a TableTop Zone running TCG demos and prize-supported tournaments.',
  E'The Game Expo is a Melbourne gaming convention with a substantial TableTop Zone that runs trading card game demos and prize-supported tournaments.\n\nPast editions have hosted Magic and Flesh and Blood tournaments, early Star Wars Unlimited demos and Japanese TCG demos alongside board games and a chess tournament, plus esports, cosplay, content creators and PC LAN gaming.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. THE VENUE IS UNKNOWN and deliberately left blank — past editions used Melbourne Showgrounds but that is not confirmed for 2027. Ticket prices and the 2027 TCG tournament lineup are also unconfirmed.]',
  'VIC', '2027-04-03'::date, '2027-04-04'::date, false, false,
  'https://www.thegameexpo.com/', 'The Game Expo',
  array['Magic: The Gathering','Flesh and Blood','Star Wars: Unlimited','Pokémon']::text[],
  array['Gaming Expo','Tabletop','TCG','Melbourne','Victoria','Tournaments','Esports']::text[],
  'https://www.thegameexpo.com/',
  'The Game Expo (TGX) 2027 — Melbourne Gaming Convention',
  'The Game Expo returns to Melbourne on 3–4 April 2027 with a TableTop Zone running trading card game demos and prize-supported tournaments, plus esports and cosplay.'
where not exists (select 1 from public.events where slug = 'the-game-expo-tgx-2027-04-03');

-- ── Supanova Gold Coast 2027 — Sat 10–Sun 11 Apr 2027, QLD ─────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, ticket_url, organizer_name, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Supanova Comic Con & Gaming — Gold Coast 2027',
  'supanova-gold-coast-2027-04-10',
  'The Gold Coast stop on the Supanova 2027 circuit, with a large trading card and collectables vendor hall.',
  E'The Gold Coast stop on the Supanova 2027 circuit, a two-day pop culture expo at the Gold Coast Convention & Exhibition Centre.\n\nSupanova events carry a large exhibitor hall with trading card and collectables retailers alongside comics, anime, gaming and celebrity guests. It is one of the few large events with a card vendor floor serving south-east Queensland outside Brisbane.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. Sources contradicted each other across the whole 2027 circuit; the readings that place Brisbane in April shift every later city by one row, and were rejected because Supanova Brisbane has always been a November show. These dates match Supanova''s documented touring pattern and fall on the right weekdays, but confirm against supanova.com.au before approving. Ticket prices unpublished.]',
  'Gold Coast Convention & Exhibition Centre', '2684 Gold Coast Highway', 'Broadbeach', 'QLD', '4218',
  '2027-04-10'::date, '2027-04-11'::date, false, false,
  'https://www.supanova.com.au/', 'https://www.supanova.com.au/home/buyticket/',
  'Supanova Pop Culture Industries',
  array['Comic Con','Pop Culture','Trading Cards','Collectables','Gold Coast','Queensland','Cosplay']::text[],
  'https://www.supanova.com.au/',
  'Supanova Gold Coast 2027 — Comic Con & Gaming',
  'Supanova returns to the Gold Coast Convention & Exhibition Centre on 10–11 April 2027. Pop culture, gaming, celebrity guests and a large trading card and collectables vendor hall.'
where not exists (select 1 from public.events where slug = 'supanova-gold-coast-2027-04-10');

-- ── Supanova Melbourne 2027 — Fri 16–Sun 18 Apr 2027, VIC ──────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, ticket_url, organizer_name, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Supanova Comic Con & Gaming — Melbourne 2027',
  'supanova-melbourne-2027-04-16',
  'Supanova Melbourne expands to three days in 2027, adding the Friday "Level Up" day, with a large card and collectables floor.',
  E'The Melbourne stop on the Supanova 2027 circuit at Melbourne Showgrounds, expanding from two days to three by adding the Friday "Level Up" schools day.\n\nSupanova Melbourne is one of the largest pop-culture events in Victoria and carries a significant trading card and collectables vendor presence alongside comics, anime, gaming and celebrity guests.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. Some sources placed Melbourne in June instead; that reading was rejected because Supanova Melbourne has consistently been the autumn show and the June slots belong to Sydney and Perth. Confirm against supanova.com.au before approving. Ticket prices unpublished.]',
  'Melbourne Showgrounds', '320 Epsom Road', 'Ascot Vale', 'VIC', '3032',
  '2027-04-16'::date, '2027-04-18'::date, false, false,
  'https://www.supanova.com.au/', 'https://www.supanova.com.au/home/buyticket/',
  'Supanova Pop Culture Industries',
  array['Comic Con','Pop Culture','Trading Cards','Collectables','Melbourne','Victoria','Cosplay']::text[],
  'https://www.supanova.com.au/',
  'Supanova Melbourne 2027 — Three Days at Melbourne Showgrounds',
  'Supanova returns to Melbourne Showgrounds from 16–18 April 2027, expanding to three days with a Friday Level Up day. Pop culture, gaming and a large trading card vendor hall.'
where not exists (select 1 from public.events where slug = 'supanova-melbourne-2027-04-16');

-- ── TCXPO Trading Card Expo – Oran Park — Sun 16 May 2027, NSW ─────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, registration_required,
  website_url, facebook_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'pending_review'::event_status, true, now(),
  'TCXPO Trading Card Expo – Oran Park (May 2027)',
  'tcxpo-trading-card-expo-oran-park-may-2027',
  'A 2027 date for the south-west Sydney expo — 200+ vendor tables across sports, entertainment and TCG cards.',
  E'TCXPO is a south-west Sydney trading card expo running roughly quarterly at Oran Park Leisure Centre with 200+ vendor tables.\n\nIt covers sports trading cards, entertainment cards and TCGs including Pokémon, Magic, One Piece and Yu-Gi-Oh!, plus accessories and grading services.\n\n[CardPop draft — THE ORGANISER IS CONTESTED. One source attributes 16 May 2027 to TCXPO at Oran Park; another attributes the same date to a Collector Con event at a different Penrith venue. One of the two is wrong. Times are carried over from 2026 editions and the entry fee is unknown. Verify before approving.]',
  'Oran Park Leisure Centre', '74 Central Avenue', 'Oran Park', 'NSW', '2570',
  '2027-05-16'::date, '09:30'::time, '15:00'::time, false, false,
  'https://tcxpo.com.au/', 'https://www.facebook.com/tcxpo/', 'TCXPO',
  array['Pokémon','Magic: The Gathering','One Piece','Yu-Gi-Oh!']::text[],
  array['Card Show','Sports Cards','Oran Park','South West Sydney','New South Wales','Grading']::text[],
  'https://tcxpo.com.au/event-info/',
  'TCXPO Trading Card Expo Oran Park — May 2027',
  'TCXPO returns to Oran Park Leisure Centre on Sunday 16 May 2027 with 200+ vendor tables. Sports cards, entertainment cards and TCGs including Pokémon, Magic, One Piece and Yu-Gi-Oh!.'
where not exists (select 1 from public.events where slug = 'tcxpo-trading-card-expo-oran-park-may-2027');

-- ── Oz Comic-Con Melbourne 2027 — Sat 12–Sun 13 Jun 2027, VIC ──────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time, is_free, registration_required,
  website_url, ticket_url, organizer_name, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Oz Comic-Con Melbourne 2027',
  'oz-comic-con-melbourne-2027-06-12',
  'Oz Comic-Con''s main Melbourne show at MCEC, with a collectables floor that includes trading card sellers.',
  E'The Melbourne stop on the Oz Comic-Con 2027 circuit, at the Melbourne Convention & Exhibition Centre.\n\nAs a general pop-culture convention it hosts a large vendor hall that includes trading card and collectibles sellers alongside comics, anime and merchandise, plus guest signings and cosplay programming.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page, though the date was returned consistently by several sources and sits one year on from the 2026 Melbourne show. Ticket prices for 2027 are not yet released.]',
  'Melbourne Convention & Exhibition Centre', '1 Convention Centre Place', 'South Wharf', 'VIC', '3006',
  '2027-06-12'::date, '2027-06-13'::date, '09:00'::time, '17:00'::time, false, false,
  'https://ozcomiccon.com/melbourne/', 'https://ozcomiccon.com/melbourne-ticket-details/',
  'Oz Comic-Con',
  array['Comic Con','Pop Culture','Collectables','Trading Cards','Melbourne','Victoria','Cosplay']::text[],
  'https://ozcomiccon.com/melbourne/',
  'Oz Comic-Con Melbourne 2027 — MCEC, June',
  'Oz Comic-Con returns to the Melbourne Convention & Exhibition Centre on 12–13 June 2027. Pop culture, guest signings, cosplay and a vendor hall with trading cards and collectibles.'
where not exists (select 1 from public.events where slug = 'oz-comic-con-melbourne-2027-06-12');

-- ── Supanova Sydney 2027 — Fri 18–Sun 20 Jun 2027, NSW ─────────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, ticket_url, organizer_name, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Supanova Comic Con & Gaming — Sydney 2027',
  'supanova-sydney-2027-06-18',
  'Three days at Sydney Showground, Supanova''s biggest show, with trading card vendors and tabletop gaming throughout.',
  E'The Sydney stop on the Supanova 2027 circuit, three days at Sydney Showground in Olympic Park and the largest show on the circuit.\n\nTrading card vendors and tabletop gaming areas are standing features of the Supanova floor, alongside comics, anime, celebrity guests and cosplay.\n\n[CardPop draft — found by an automated web sweep, not verified against the organiser''s page. Sources split between 18–20 and 25–27 June for Sydney. 18–20 is recorded because Sydney has taken the first June weekend and Perth the second in recent years, and every source giving Sydney the later weekend also carried an impossible Melbourne date, marking it as the shifted reading. Confirm before approving. Ticket prices unpublished.]',
  'Sydney Showground', '1 Showground Road', 'Sydney Olympic Park', 'NSW', '2127',
  '2027-06-18'::date, '2027-06-20'::date, false, false,
  'https://www.supanova.com.au/', 'https://www.supanova.com.au/home/buyticket/',
  'Supanova Pop Culture Industries',
  array['Comic Con','Pop Culture','Trading Cards','Collectables','Sydney','New South Wales','Cosplay']::text[],
  'https://www.supanova.com.au/',
  'Supanova Sydney 2027 — Sydney Showground, June',
  'Supanova returns to Sydney Showground from 18–20 June 2027. Three days of pop culture, gaming, celebrity guests, trading card vendors and tabletop gaming.'
where not exists (select 1 from public.events where slug = 'supanova-sydney-2027-06-18');

-- ── Supanova Perth 2027 — Fri 25–Sun 27 Jun 2027, WA ───────────────────────
insert into public.events (
  event_type, status, auto_discovered, discovered_at,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, is_free, registration_required,
  website_url, ticket_url, organizer_name, tags, source_url, seo_title, seo_description
)
select
  'community_event'::event_type, 'pending_review'::event_status, true, now(),
  'Supanova Comic Con & Gaming — Perth 2027',
  'supanova-perth-2027-06-25',
  'The Perth stop on the Supanova 2027 circuit at PCEC, with trading card and collectables vendors throughout.',
  E'The Perth stop on the Supanova 2027 circuit at the Perth Convention & Exhibition Centre, on the second June weekend after Sydney.\n\nSupanova carries a large exhibitor hall with trading card and collectables retailers alongside comics, anime, gaming, celebrity guests and cosplay.\n\n[CardPop draft — the least certain of the four Supanova 2027 dates. Sources split between 18–20 and 25–27 June; 25–27 is recorded because Perth consistently follows Sydney. The bigger open question is the length: this is recorded as a three-day Friday–Sunday event, but Perth ran two days (Sat–Sun) in both 2025 and 2026. If the three-day expansion is wrong, the likely correct dates are 26–27 June 2027. VERIFY THIS ONE BEFORE APPROVING.]',
  'Perth Convention & Exhibition Centre', '21 Mounts Bay Road', 'Perth', 'WA', '6000',
  '2027-06-25'::date, '2027-06-27'::date, false, false,
  'https://www.supanova.com.au/', 'https://www.supanova.com.au/home/buyticket/',
  'Supanova Pop Culture Industries',
  array['Comic Con','Pop Culture','Trading Cards','Collectables','Perth','Western Australia','Cosplay']::text[],
  'https://www.supanova.com.au/',
  'Supanova Perth 2027 — Perth Convention & Exhibition Centre',
  'Supanova returns to the Perth Convention & Exhibition Centre from 25–27 June 2027. Pop culture, gaming, celebrity guests and a trading card and collectables vendor hall.'
where not exists (select 1 from public.events where slug = 'supanova-perth-2027-06-25');
