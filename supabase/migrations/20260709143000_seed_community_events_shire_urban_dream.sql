-- Seed three community trading-card events onto the /events calendar, sourced from
-- the organisers' Instagram announcements:
--
--   1. Shire CollExpo — Sutherland Shire (Sydney), NSW — Sun 11 Oct 2026 (card show)
--   2. Urban Empire Trade Day — Bennetts Green (Newcastle), NSW — Sat 11 Jul 2026 (trade event)
--   3. Pokémon Mega Evolution: Pitch Black Pre-Release — Dream Collectables,
--      Westfield Knox (Melbourne), VIC — Sun 12 Jul 2026 (LGS event)
--
-- All three land 'approved' so they're live on the calendar immediately. Each insert
-- is idempotent: re-running skips the row if an event with the same slug already exists.
-- Details that couldn't be confirmed from the source flyer (exact venue/entry for the
-- Shire show, the Eventbrite link for the pre-release) are left to the organiser links
-- and noted in the descriptions rather than invented.

-- ── 1. Shire CollExpo (card show) ──────────────────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, suburb, state, postcode,
  start_date, is_free, registration_required,
  instagram_url, organizer_name,
  tags, seo_title, seo_description
)
select
  'card_show'::event_type,
  'approved'::event_status,
  'Shire CollExpo',
  'shire-collexpo-2026-10-11',
  'The Sutherland Shire''s trading card & collectable expo returns to Sydney — vendors, singles, sealed and slabs all under one roof.',
  E'Shire CollExpo is back! The Sutherland Shire''s trading card & collectable expo returns to Sydney on Sunday 11 October 2026.\n\nExpect a room full of vendors buying, selling and trading Pokémon, sports cards, graded slabs, sealed product, Funko Pops and collectables — plus the chance to meet fellow collectors from across the Shire and greater Sydney.\n\nVendor applications are now open — DM @shirecollexpo on Instagram to book a table. Entry pricing, the exact venue and session times are confirmed closer to the date, so follow @shirecollexpo for the latest details before you head down.',
  null,
  'Sutherland',
  'NSW',
  '2232',
  '2026-10-11'::date,
  false,
  false,
  'https://www.instagram.com/shirecollexpo',
  'Shire CollExpo',
  array['Card Show','Trading Cards','Collectables','Sutherland Shire','Sydney','Pokemon','Sports Cards']::text[],
  'Shire CollExpo 2026 — Sutherland Shire Trading Card Expo',
  'Shire CollExpo returns to Sydney''s Sutherland Shire on Sunday 11 October 2026 — trading cards, collectables and vendors under one roof. Vendor applications now open.'
where not exists (
  select 1 from public.events where slug = 'shire-collexpo-2026-10-11'
);

-- ── 2. Urban Empire Trade Day (trade event) ────────────────────────────────────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time, is_free, entry_fee_aud, registration_required,
  website_url, instagram_url, organizer_name,
  featured_card_games, tags, seo_title, seo_description
)
select
  'trade_event'::event_type,
  'approved'::event_status,
  'Urban Empire Trade Day',
  'urban-empire-trade-day-2026-07-11',
  'Buy, sell & trade with the local collecting community — free entry, a free sausage sizzle and giveaways throughout the day.',
  E'Urban Empire Collectables is hosting a Trade Day at their Bennetts Green store — bring your cards, bring your friends, and have a great day!\n\nBuy, sell and trade with the local collecting community across Pokémon, Magic: The Gathering, One Piece, Yu-Gi-Oh!, Dragon Ball Super, Riftbound, Gundam, sports cards (NRL, NBA, FIFA, Topps Baseball) and more.\n\nOn the day: a FREE sausage sizzle, giveaways throughout the day, and the chance to meet other collectors and make new connections.\n\nSaturday 11 July 2026, 10:00am – 3:00pm at Unit 4/2 Templar Place, Bennetts Green NSW. Follow @urbanempirecollectables for updates.',
  'Urban Empire Collectables',
  'Unit 4/2 Templar Place',
  'Bennetts Green',
  'NSW',
  '2290',
  '2026-07-11'::date,
  '10:00'::time,
  '15:00'::time,
  true,
  0,
  false,
  'https://urbanempirecollectables.com',
  'https://www.instagram.com/urbanempirecollectables',
  'Urban Empire Collectables',
  array['Pokémon','Magic: The Gathering','One Piece','Yu-Gi-Oh!','Dragon Ball Super']::text[],
  array['Trade Day','Buy Sell Trade','Pokemon','Sports Cards','Newcastle','Riftbound','Gundam','Free Entry']::text[],
  'Urban Empire Trade Day — Newcastle Card Buy, Sell & Trade',
  'Urban Empire Collectables Trade Day in Bennetts Green (Newcastle) on Saturday 11 July 2026, 10am–3pm. Free entry, sausage sizzle and giveaways. Buy, sell & trade Pokémon, MTG, One Piece, sports cards and more.'
where not exists (
  select 1 from public.events where slug = 'urban-empire-trade-day-2026-07-11'
);

-- ── 3. Pokémon Mega Evolution: Pitch Black Pre-Release @ Dream Collectables ────
insert into public.events (
  event_type, status, title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, is_free, entry_fee_aud, capacity, registration_required,
  instagram_url, organizer_name,
  featured_card_games, tags, seo_title, seo_description
)
select
  'lgs_event'::event_type,
  'approved'::event_status,
  'Pokémon Mega Evolution: Pitch Black Pre-Release',
  'pokemon-mega-evolution-pitch-black-pre-release-2026-07-12',
  'Be among the first to crack the new Pokémon Mega Evolution: Pitch Black set — $50 entry, capacity limited to 30 players. Reserve on Eventbrite.',
  E'Dream Collectables is running a Pokémon Mega Evolution: Pitch Black pre-release event — get your hands on the new set before it hits shelves!\n\nSunday 12 July 2026 @ 5:00pm. Entry is $50 and capacity is strictly limited to 30 players, so lock in your spot early.\n\nReserve your seat on Eventbrite (search "Dream Collectables"). Held in-store at Dream Collectables, Shop 3107, Westfield Knox. Follow @dreamcollectables_ for details.',
  'Dream Collectables',
  'Shop 3107, Westfield Knox, 425 Burwood Highway',
  'Wantirna South',
  'VIC',
  '3152',
  '2026-07-12'::date,
  '17:00'::time,
  false,
  50,
  30,
  true,
  'https://www.instagram.com/dreamcollectables_',
  'Dream Collectables',
  array['Pokémon']::text[],
  array['Pre-Release','Pokemon','Mega Evolution','Pitch Black','Westfield Knox','Melbourne','Tournament']::text[],
  'Pokémon Pitch Black Pre-Release — Dream Collectables, Knox',
  'Pokémon Mega Evolution: Pitch Black pre-release at Dream Collectables, Westfield Knox on Sunday 12 July 2026, 5pm. $50 entry, limited to 30 players. Reserve on Eventbrite.'
where not exists (
  select 1 from public.events where slug = 'pokemon-mega-evolution-pitch-black-pre-release-2026-07-12'
);
