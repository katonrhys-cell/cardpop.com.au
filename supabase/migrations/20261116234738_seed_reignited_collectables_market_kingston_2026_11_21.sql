-- Draft "Reignited Collectables Market" (Sat 21 Nov 2026, Kingborough Community
-- Hub, Kingston TAS).
--
-- Source: the organiser's Instagram flyer only. It gives the name, the date, the
-- hours (10am–3pm), the venue and the street address. A web search on 2026-11-16
-- found nothing else about the event or the organiser, so nothing more is
-- filled in. The entry price, ticketing, Instagram handle, vendor count and the
-- games on offer are all left NULL instead of guessed. The postcode (7050) is
-- Kingston's.
--
-- This row lands as `pending_review`, the same state the 2026-08-05 seed
-- (20260805212434_seed_discovered_events_late_2026_2027.sql) used for its
-- drafts, so nothing reaches the public calendar until an admin approves it in
-- Admin → Event Management. It came from the flyer, not the scanner, so
-- auto_discovered stays false and admins get the usual "needs review" bell.
--
-- Idempotent: skipped if the slug already exists.

insert into public.events (
  event_type, status,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time,
  registration_required,
  organizer_name,
  tags,
  seo_title, seo_description, seo_keywords
)
select
  'card_show'::event_type, 'pending_review'::event_status,
  'Reignited Collectables Market',
  'reignited-collectables-market-kingston-2026-11-21',
  'A collectables market from Reignited Collectables at the Kingborough Community Hub in Kingston, Tasmania. Saturday 21 November, 10am to 3pm.',
  E'Reignited Collectables is running a market at the Kingborough Community Hub in Kingston, south of Hobart, on Saturday 21 November 2026. The organiser''s motto is "Community, Passion, Positivity".\n\n'
  || E'Times\n'
  || E'- Open 10:00am to 3:00pm\n\n'
  || E'Getting there\n'
  || E'The Kingborough Community Hub is at 7 Goshawk Way, Kingston TAS 7050.\n\n'
  || E'[CardPop draft, taken from the organiser''s Instagram flyer. Check the entry price, ticketing and the games or collectables on sale, and add the organiser''s Instagram link, before approving. Delete this line when approving.]',
  'Kingborough Community Hub', '7 Goshawk Way', 'Kingston', 'TAS', '7050',
  '2026-11-21'::date, '10:00'::time, '15:00'::time,
  false,
  'Reignited Collectables',
  array['Card Show','Collectibles','Market','Kingston','Hobart','Tasmania']::text[],
  'Reignited Collectables Market | Kingston TAS, 21 November 2026',
  'Reignited Collectables Market at the Kingborough Community Hub, 7 Goshawk Way, Kingston TAS, on Saturday 21 November 2026, 10am to 3pm.',
  array[
    'Reignited Collectables',
    'Reignited Collectables Market',
    'collectables market Kingston Tasmania',
    'card show Hobart',
    'trading card market Tasmania',
    'Kingborough Community Hub market'
  ]::text[]
where not exists (
  select 1 from public.events where slug = 'reignited-collectables-market-kingston-2026-11-21'
);
