-- The Ultimate Sports Collectors Convention, Sun 6 December 2026, at the
-- Seaworks Maritime Museum (Seaworks Maritime Precinct), Williamstown VIC.
-- Hosted by Fast Break Trading Cards Pty Ltd & Sports Addicts Australia,
-- presented by Whatnot.
--
-- Taken from the organiser's TryBooking listing (event 1637442) and the
-- official site (ultimatesportscollectorsconvention.com.au) as at 2 Nov 2026:
--   - 10:00am–5:00pm; VIP and kids-with-a-VIP-adult early entry 9:30am
--   - 140+ vendor tables, live breaks, giveaways, special guests, food trucks
--   - Tickets: Collector's VIP $25 (early entry, tote bag, Topps Flagship
--     Football pack), General Admission $20, Kids Under 12 free
--   - Getting there: Williamstown station (10 min walk), buses 420 and 475,
--     free street parking
-- SEO title / meta description / keywords are filled in for the Event rich
-- result, and a pinned Information Board post covers the visitor details.
-- `ticket_url` is the TryBooking page and doubles as `source_url`, so the
-- weekly event watch queues any date, venue or price change for an admin.
--
-- No cover image or logos are set. Add them from Admin → Events, and save the
-- organisers' logos to the organiser list from the Organiser tab.
--
-- Idempotent: the event insert is skipped when the slug exists, and the board
-- post is skipped when one with the same title is already on the board.

insert into public.events (
  event_type, status, is_featured, is_free, registration_required,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time,
  entry_fee_aud, ticket_prices,
  website_url, ticket_url, source_url,
  organizer_name,
  age_restrictions, accessibility_info,
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
  'Melbourne''s big sports card and memorabilia show at Seaworks, Williamstown, on Sunday 6 December 2026. 140+ vendor tables, live breaks, giveaways, special guests and food trucks. Presented by Whatnot. Tickets from $20, kids under 12 free.',
  E'Join us for the Ultimate Sports Collectors Convention, Victoria''s must-attend celebration of sports cards, memorabilia and collecting culture. Presented by Whatnot and hosted by Fast Break Trading Cards and Sports Addicts Australia, it takes over the Seaworks Maritime Museum in Williamstown on Sunday 6 December 2026.\n\nBringing together collectors, vendors, hobby stores and sports fans from across Australia, the convention will feature:\n- More than 140 vendor tables\n- Sports cards, memorabilia and collectables: AFL, basketball, soccer, cricket, baseball and more\n- Buying, selling and trading opportunities\n- Live breaks, giveaways and interactive activations\n- Special guests and exclusive event experiences\n- Food trucks and entertainment throughout the day\n- A welcoming, family-friendly atmosphere\n\nWhether you''re searching for a grail card, adding to your collection, meeting other collectors or discovering the hobby for the first time, the Ultimate Sports Collectors Convention promises an unforgettable day for sports fans of all ages.\n\nWHEN\nSunday 6 December 2026, 10:00am–5:00pm. Collector''s VIP ticket holders (and kids with a VIP adult) get in early from 9:30am.\n\nTICKETS (via TryBooking)\nAll tickets include full floor access and the chance to buy, sell and trade with Australia''s finest collectors.\n- Collector''s VIP: $25. Early access to the venue (9:30am entry), free tote bag, free Topps Flagship Football pack, full floor access and food truck precinct access\n- General Admission: $20. Full floor access (10:00am entry) and food truck precinct access\n- Kids Under 12: FREE. Early access to the venue with a VIP adult, free tote bag, free Topps Flagship Football pack, full floor access and food truck precinct access\n\nFOOD TRUCKS\nA selection of food trucks will be on site throughout the day, with something for everyone to enjoy between browsing the floor.\n\nVENUE & GETTING THERE\nSeaworks Maritime Museum (Seaworks Maritime Precinct), 82 Nelson Place, Williamstown VIC 3016, Melbourne.\n- Train: Williamstown Station, about a 10-minute walk\n- Bus: routes 420 and 475 stop nearby\n- Car: free street parking is available\n\nPartners, sponsors and the vendor line-up are on the official site, ultimatesportscollectorsconvention.com.au.',
  'Seaworks Maritime Museum',
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
  'https://ultimatesportscollectorsconvention.com.au',
  'https://www.trybooking.com/au/event/1637442',
  'https://www.trybooking.com/au/event/1637442',
  'Fast Break Trading Cards Pty Ltd & Sports Addicts Australia',
  'All ages, family friendly. Kids under 12 are free and enter early with a Collector''s VIP adult.',
  'Williamstown Station is about a 10-minute walk; bus routes 420 and 475 stop nearby, and free street parking is available around Nelson Place.',
  array[
    'Card Show','Sports Cards','Trading Cards','Memorabilia','Collectables','Live Breaks','Giveaways',
    'AFL Cards','Basketball Cards','Soccer Cards','Topps','Food Trucks','Whatnot',
    'Fast Break Trading Cards','Sports Addicts Australia','Melbourne','Williamstown','Seaworks',
    'Family Friendly'
  ]::text[],
  'Ultimate Sports Collectors Convention Melbourne 2026',
  'Melbourne sports card show, Sun 6 Dec 2026 at Seaworks Williamstown. 140+ vendor tables, memorabilia, live breaks & giveaways. From $20, kids under 12 free.',
  array[
    'Ultimate Sports Collectors Convention',
    'Ultimate Sports Collectors Convention Melbourne',
    'Ultimate Sports Collectors Convention 2026',
    'sports card show Melbourne',
    'sports card show Melbourne December 2026',
    'sports card convention Melbourne',
    'sports memorabilia show Melbourne',
    'card show Williamstown',
    'Seaworks Williamstown events',
    'AFL card show Melbourne',
    'basketball card show Melbourne',
    'Topps card event Melbourne',
    'Whatnot card show Australia',
    'Fast Break Trading Cards',
    'Sports Addicts Australia',
    'things to do Melbourne December 2026',
    'family events Williamstown December 2026'
  ]
where not exists (
  select 1 from public.events where slug = 'ultimate-sports-collectors-convention-2026-12-06'
);

-- Information Board: a pinned visitor guide. Board posts need an author
-- profile, so the longest-standing admin stands in. The post is skipped when
-- there is no admin (e.g. on a fresh local database).
with ev as (
  select id from public.events where slug = 'ultimate-sports-collectors-convention-2026-12-06'
), author as (
  select id from public.profiles where is_admin = true order by created_at asc limit 1
)
insert into public.event_board_posts (event_id, author_id, title, body, is_pinned)
select ev.id, author.id, p.title, p.body, true
from ev, author, (values
  (
    'Plan your visit: tickets, entry times and getting to Seaworks',
    E'When: Sunday 6 December 2026, 10:00am–5:00pm. Collector''s VIP tickets (and kids under 12 with a VIP adult) get in early at 9:30am. General admission opens at 10:00am.\n\nWhere: Seaworks Maritime Museum, 82 Nelson Place, Williamstown VIC 3016.\n\nTickets (TryBooking): Collector''s VIP $25 (early entry, free tote bag, free Topps Flagship Football pack), General Admission $20, Kids Under 12 free. Every ticket includes full floor access and the food truck precinct.\n\nGetting there: Williamstown Station is about a 10-minute walk, bus routes 420 and 475 stop nearby, and there''s free street parking around Nelson Place.\n\nOn the floor: 140+ vendor tables of sports cards, memorabilia and collectables, live breaks, giveaways, special guests and food trucks all day. Bring cash and card, top-loaders or a binder for trades, and your want list. Selling on CardPop? RSVP as a vendor on this page so collectors know to find you.'
  )
) as p(title, body)
where not exists (
  select 1 from public.event_board_posts b
  where b.event_id = ev.id and b.title = p.title
);
