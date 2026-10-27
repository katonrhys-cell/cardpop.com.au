-- Seed "The Hobby Hangout XL Melbourne 2025" (Sun 1 June 2025, Royal Exhibition
-- Building, Carlton VIC) as a past event, so an admin event review can be
-- written against it and linked through event_reviews.event_id.
--
-- Sources: thehobbyhangout.com.au (organiser: the 2025 Melbourne show sold out),
-- vendor announcements for the June 2025 show (doors 10:30am, close 5:30pm) and
-- the OzCardTrader "Melbourne Hobby Hangout Sunday 1 June 2025" thread.
--
-- Lands as 'completed' (the admin archive) so it shows under Past Events and
-- keeps its page. Ticket prices for 2025 weren't published anywhere still
-- reachable, so entry_fee_aud / presale_fee_aud stay NULL rather than guessed,
-- and ticket_url is left empty (the Universe link now sells the next show).
-- No image is seeded: the series' artwork in storage is dated for later shows.
-- Idempotent: skipped if the slug already exists.

insert into public.events (
  event_type, status,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time, end_time,
  is_free, registration_required,
  website_url, organizer_name, facebook_url, instagram_url,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'completed'::event_status,
  'The Hobby Hangout XL Melbourne 2025',
  'hobby-hangout-xl-melbourne-2025',
  'The sold-out Hobby Hangout XL took over Melbourne''s Royal Exhibition Building on Sunday 1 June 2025 — sports cards, Pokémon and TCG vendors, live breaks and trading zones.',
  E'The Hobby Hangout XL brought one of Australia''s biggest trading card shows to Melbourne''s heritage-listed Royal Exhibition Building in Carlton on Sunday 1 June 2025, with doors open from 10:30am to 5:30pm.\n\nThe floor was packed with tables from Australian and international vendors covering sports cards (NBA, NFL, MLB, AFL and soccer), Pokémon, One Piece, Yu-Gi-Oh! and Magic: The Gathering, alongside live breaks, dedicated trading zones, free play areas and special guests. Collectors came for everything from graded slabs and vintage singles to sealed boxes and bargain bins.\n\nThe 2025 Melbourne show sold out — the organiser''s biggest event at the time — and the Hobby Hangout XL has since returned to the Royal Exhibition Building. Parking is available under the Melbourne Museum next door, and the venue is a short tram ride from the CBD.\n\nWere you there? Leave a collector review below, and read CardPop''s own write-up of the day.',
  'Royal Exhibition Building', '9 Nicholson Street', 'Carlton', 'VIC', '3053',
  '2025-06-01'::date, '2025-06-01'::date, '10:30'::time, '17:30'::time,
  false, false,
  'https://www.thehobbyhangout.com.au/', 'The Hobby Hangout',
  'https://www.facebook.com/hobbyhangoutau/', 'https://www.instagram.com/thehobbyhangoutau/',
  array['Pokémon','One Piece','Yu-Gi-Oh!','Magic: The Gathering','Sports Cards']::text[],
  array['card show','melbourne','hobby hangout','2025','trading cards','sports cards','pokemon','royal exhibition building','carlton','victoria']::text[],
  'https://www.thehobbyhangout.com.au/',
  'Hobby Hangout XL Melbourne 2025 – Trading Card Show Recap',
  'Hobby Hangout XL Melbourne, Sunday 1 June 2025 at the Royal Exhibition Building, Carlton. The sold-out card show: sports cards, Pokémon, TCGs, live breaks and trading zones.'
where not exists (select 1 from public.events where slug = 'hobby-hangout-xl-melbourne-2025');
