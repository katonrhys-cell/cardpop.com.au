-- The Ultimate Sports Collectors Convention — Sun 6 December 2026,
-- Seaworks Maritime Precinct, Williamstown VIC. Hosted by Fast Break Trading
-- Cards Pty Ltd & Sports Addicts Australia, presented by Whatnot.
--
-- Taken from the organiser's TryBooking listing (event 1637442) as at 2 Nov
-- 2026: 10:00am–5:00pm, 140+ vendor tables, live breaks and giveaways, food
-- trucks. Tickets: Collector's VIP $25 (9:30am early entry, tote bag, Topps
-- Flagship Football pack), General Admission $20 (10am), Kids Under 12 free
-- with a VIP adult. `ticket_url` is the TryBooking page and doubles as
-- `source_url`, so the weekly event watch queues any change for an admin.
--
-- No cover image or logos are set — add them from Admin → Events (and save the
-- organisers' logos to the organiser list from the Organiser tab).
--
-- Idempotent: skipped when the slug already exists.

insert into public.events (
  event_type, status, is_featured, is_free, registration_required,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time,
  entry_fee_aud, ticket_prices,
  ticket_url, source_url,
  organizer_name,
  age_restrictions,
  tags,
  seo_title, seo_description, seo_keywords
)
select
  'card_show'::event_type,
  'approved'::event_status,
  false,
  false,
  true,
  'The Ultimate Sports Collectors Convention — Melbourne',
  'ultimate-sports-collectors-convention-2026-12-06',
  'Victoria''s must-attend celebration of sports cards, memorabilia and collecting culture at Seaworks, Williamstown. 140+ vendor tables, live breaks, giveaways and food trucks. Presented by Whatnot. From $20, kids under 12 free.',
  E'Join us for the Ultimate Sports Collectors Convention — Victoria''s must-attend celebration of sports cards, memorabilia and collecting culture, presented by Whatnot.\n\nBringing together collectors, vendors, hobby stores and sports fans from across Australia, the convention will feature:\n- More than 140 vendor tables\n- Sports cards, memorabilia and collectables\n- Buying, selling and trading opportunities\n- Live breaks, giveaways and interactive activations\n- Special guests and exclusive event experiences\n- Food trucks and entertainment throughout the day\n- A welcoming, family-friendly atmosphere\n\nWhether you''re searching for a grail card, adding to your collection, meeting other collectors or discovering the hobby for the first time, the Ultimate Sports Collectors Convention promises an unforgettable day for sports fans of all ages.\n\nWHEN\nSunday 6 December 2026, 10:00am–5:00pm.\n\nTICKETS (via TryBooking)\n- Collector''s VIP: $25 — early access to the venue (9:30am entry), free tote bag, free Topps Flagship Football pack, full floor access and food truck precinct access\n- General Admission: $20 — full floor access (10:00am entry) and food truck precinct access\n- Kids Under 12: FREE — early access to the venue with a VIP adult, free tote bag, free Topps Flagship Football pack, full floor access and food truck precinct access\n\nWHERE\nSeaworks Maritime Precinct, 82 Nelson Place, Williamstown VIC 3016.\n\nHosted by Fast Break Trading Cards Pty Ltd & Sports Addicts Australia.',
  'Seaworks Maritime Precinct',
  '82 Nelson Place',
  'Williamstown',
  'VIC',
  '3016',
  '2026-12-06'::date,
  '2026-12-06'::date,
  '10:00'::time,
  '17:00'::time,
  20,
  '[{"type": "child", "price_aud": 0}, {"type": "vip", "price_aud": 25}]'::jsonb,
  'https://www.trybooking.com/au/event/1637442',
  'https://www.trybooking.com/au/event/1637442',
  'Fast Break Trading Cards Pty Ltd & Sports Addicts Australia',
  'All ages. Kids under 12 are free with a VIP adult.',
  array[
    'Card Show','Sports Cards','Trading Cards','Memorabilia','Collectables','Live Breaks','Giveaways',
    'Food Trucks','Whatnot','Fast Break Trading Cards','Sports Addicts Australia','Melbourne',
    'Williamstown','Seaworks','Family Friendly'
  ]::text[],
  'Ultimate Sports Collectors Convention Melbourne | 6 Dec 2026, Seaworks',
  'Ultimate Sports Collectors Convention, Sun 6 Dec 2026, Seaworks Williamstown. 140+ vendor tables, sports cards, memorabilia, live breaks & giveaways. From $20, kids free.',
  array[
    'Ultimate Sports Collectors Convention',
    'sports card show Melbourne',
    'sports collectors convention Melbourne 2026',
    'Seaworks Williamstown card show',
    'Fast Break Trading Cards',
    'Sports Addicts Australia',
    'sports memorabilia show Melbourne December 2026',
    'card show Melbourne December 2026'
  ]
where not exists (
  select 1 from public.events where slug = 'ultimate-sports-collectors-convention-2026-12-06'
);
