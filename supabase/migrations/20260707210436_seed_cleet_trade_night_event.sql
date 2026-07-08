-- Seed the "Trade Night at CLEET Collectables" event (South Morang, VIC — Sat 8 Aug 2026).
-- Requested by the store owner: a free trade night that requires an RSVP to CLEET
-- Collectables via a Whatnot message by Mon 3 Aug 2026. The event is connected to
-- CLEET's business account through organiser_id so it surfaces under their profile/store.
--
-- The RSVP button (ticket_url) is wired to CLEET's saved Whatnot channel by reading
-- social_links->>'whatnot' from their profile at apply time — no personal phone number
-- is published on the listing.
--
-- Lands approved so it's live on the /events calendar immediately. Idempotent:
-- re-running skips the insert if an event with this slug already exists.

insert into public.events (
  organiser_id,
  event_type,
  status,
  title,
  slug,
  short_description,
  description,
  image_url,
  venue_name,
  address,
  suburb,
  state,
  postcode,
  start_date,
  start_time,
  is_free,
  entry_fee_aud,
  registration_required,
  ticket_url,
  organizer_name,
  tags,
  seo_title,
  seo_description
)
select
  'b026a0fc-be2c-487e-bc51-72340c9bd67e'::uuid,        -- CLEET Collectables business account
  'trade_event'::event_type,
  'approved'::event_status,
  'Trade Night at CLEET Collectables',
  'trade-night-at-cleet-collectables-2026-08-08',
  'Free trade night at CLEET Collectables'' South Morang warehouse — food & drinks provided. RSVP via a Whatnot message by Monday 3 August.',
  E'CLEET Collectables is hosting a Trade Night at our South Morang warehouse — bring your cards, meet fellow collectors and make some deals. Food and drinks provided.\n\nEntry is FREE, but you must RSVP by Monday 3 August 2026 — send CLEET Collectables a message on Whatnot to reserve your spot.\n\nThe warehouse is gated, so once you''ve RSVP''d we''ll share the arrival details.',
  '/images/events/cleet-collectables-trade-night-2026-08-08.jpg',
  'CLEET Collectables',
  '7/33 Danaher Drive',
  'South Morang',
  'VIC',
  '3752',
  '2026-08-08'::date,
  '18:00'::time,
  true,
  0,
  true,
  (select p.social_links->>'whatnot' from public.profiles p
     where p.id = 'b026a0fc-be2c-487e-bc51-72340c9bd67e'::uuid),  -- CLEET's saved Whatnot channel
  'CLEET Collectables',
  array['Trade Night', 'Sports Cards', 'Basketball Cards', 'Graded Cards', 'South Morang', 'Melbourne']::text[],
  'Trade Night at CLEET Collectables — South Morang',
  'Free trading card trade night at CLEET Collectables in South Morang, Melbourne on Saturday 8 August 2026. Food & drinks provided. RSVP to CLEET via Whatnot by 3 August.'
where not exists (
  select 1 from public.events
  where slug = 'trade-night-at-cleet-collectables-2026-08-08'
);
