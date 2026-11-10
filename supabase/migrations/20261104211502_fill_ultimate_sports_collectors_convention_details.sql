-- Fill in The Ultimate Sports Collectors Convention (Sun 6 Dec 2026, Seaworks
-- Maritime Museum, Williamstown).
--
-- 20261102100000_seed_ultimate_sports_collectors_convention_2026.sql was
-- skipped in production: an event with the same slug had been listed since
-- July 2026 as a placeholder ("session times and entry pricing are confirmed
-- closer to the date", $0 entry, no ticket link, the event's own name as its
-- organiser). The seed only inserts when the slug is free, so none of the
-- organiser's details landed; only the seed's pinned visitor-guide board post
-- did, and it quotes prices the page didn't show.
--
-- This updates that row with the details from the organiser's TryBooking
-- listing (event 1637442) and official site, the same values the seed carried:
-- times (10am–5pm, VIP 9:30am), tickets (GA $20, Collector's VIP $25, kids
-- under 12 free), the TryBooking link (also the weekly watch's source_url),
-- the website, getting-there notes, SEO copy, and the real hosts as organiser
-- ("Fast Break Trading Cards Pty Ltd & Sports Addicts Australia", which links
-- both organiser pages). The title, slug, cover image, venue address and
-- status are left as they are.
--
-- The organiser directory backfill (20261102093000) recorded the placeholder
-- organiser name "The Ultimate Sports Collectors Convention" as an organiser;
-- with no event naming it any more, that row is removed.

update public.events
set
  short_description = 'Melbourne''s big sports card and memorabilia show at Seaworks, Williamstown, on Sunday 6 December 2026. 140+ vendor tables, live breaks, giveaways, special guests and food trucks. Presented by Whatnot. Tickets from $20, kids under 12 free.',
  description = E'Join us for the Ultimate Sports Collectors Convention, Victoria''s must-attend celebration of sports cards, memorabilia and collecting culture. Presented by Whatnot and hosted by Fast Break Trading Cards and Sports Addicts Australia, it takes over the Seaworks Maritime Museum in Williamstown on Sunday 6 December 2026.\n\nBringing together collectors, vendors, hobby stores and sports fans from across Australia, the convention will feature:\n- More than 140 vendor tables\n- Sports cards, memorabilia and collectables: AFL, basketball, soccer, cricket, baseball and more\n- Buying, selling and trading opportunities\n- Live breaks, giveaways and interactive activations\n- Special guests and exclusive event experiences\n- Food trucks and entertainment throughout the day\n- A welcoming, family-friendly atmosphere\n\nWhether you''re searching for a grail card, adding to your collection, meeting other collectors or discovering the hobby for the first time, the Ultimate Sports Collectors Convention promises an unforgettable day for sports fans of all ages.\n\nWHEN\nSunday 6 December 2026, 10:00am–5:00pm. Collector''s VIP ticket holders (and kids with a VIP adult) get in early from 9:30am.\n\nTICKETS (via TryBooking)\nAll tickets include full floor access and the chance to buy, sell and trade with Australia''s finest collectors.\n- Collector''s VIP: $25. Early access to the venue (9:30am entry), free tote bag, free Topps Flagship Football pack, full floor access and food truck precinct access\n- General Admission: $20. Full floor access (10:00am entry) and food truck precinct access\n- Kids Under 12: FREE. Early access to the venue with a VIP adult, free tote bag, free Topps Flagship Football pack, full floor access and food truck precinct access\n\nFOOD TRUCKS\nA selection of food trucks will be on site throughout the day, with something for everyone to enjoy between browsing the floor.\n\nVENUE & GETTING THERE\nSeaworks Maritime Museum (Seaworks Maritime Precinct), 82 Nelson Place, Williamstown VIC 3016, Melbourne.\n- Train: Williamstown Station, about a 10-minute walk\n- Bus: routes 420 and 475 stop nearby\n- Car: free street parking is available\n\nPartners, sponsors and the vendor line-up are on the official site, ultimatesportscollectorsconvention.com.au.',
  venue_name = 'Seaworks Maritime Museum',
  end_date = '2026-12-06'::date,
  start_time = '10:00'::time,
  end_time = '17:00'::time,
  entry_fee_aud = 20,
  ticket_prices = '[{"type": "child", "price_aud": 0}, {"type": "vip", "price_aud": 25}]'::jsonb,
  website_url = 'https://ultimatesportscollectorsconvention.com.au',
  ticket_url = 'https://www.trybooking.com/au/event/1637442',
  source_url = 'https://www.trybooking.com/au/event/1637442',
  organizer_name = 'Fast Break Trading Cards Pty Ltd & Sports Addicts Australia',
  age_restrictions = 'All ages, family friendly. Kids under 12 are free and enter early with a Collector''s VIP adult.',
  accessibility_info = 'Williamstown Station is about a 10-minute walk; bus routes 420 and 475 stop nearby, and free street parking is available around Nelson Place.',
  tags = array[
    'Card Show','Sports Cards','Trading Cards','Memorabilia','Collectables','Live Breaks','Giveaways',
    'AFL Cards','Basketball Cards','Soccer Cards','Topps','Food Trucks','Whatnot',
    'Fast Break Trading Cards','Sports Addicts Australia','Melbourne','Williamstown','Seaworks',
    'Family Friendly'
  ]::text[],
  seo_title = 'Ultimate Sports Collectors Convention Melbourne 2026',
  seo_description = 'Melbourne sports card show, Sun 6 Dec 2026 at Seaworks Williamstown. 140+ vendor tables, memorabilia, live breaks & giveaways. From $20, kids under 12 free.',
  seo_keywords = array[
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
  ],
  registration_required = true
where slug = 'ultimate-sports-collectors-convention-2026-12-06';

delete from public.event_organisers o
where o.name = 'The Ultimate Sports Collectors Convention'
  and not exists (
    select 1 from public.events e
    where lower(btrim(e.organizer_name)) = lower(o.name)
  );
