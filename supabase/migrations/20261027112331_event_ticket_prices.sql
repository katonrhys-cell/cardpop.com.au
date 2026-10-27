-- Extra ticket prices on an event: Child, VIP, GA Early Access, GA Late
-- Access and Group (a price for N people), chosen per event in the event
-- form's Organiser tab and listed on the event page under Entry. Shape and
-- labels live in utils/eventTicketPrices.js:
--   [{ "type": "child" | "vip" | "ga_early" | "ga_late" | "group",
--      "price_aud": 12.5, "group_size": 4 /* group only */ }]
-- The general-admission entry fee and presale price stay in entry_fee_aud /
-- presale_fee_aud.
--
-- events_public is recreated to expose the column (appended — `create or
-- replace view` can't drop or reorder). Everything else is exactly
-- 20261027110841_event_gallery_images.sql.

alter table public.events
  add column if not exists ticket_prices jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_ticket_prices_is_array') then
    alter table public.events
      add constraint events_ticket_prices_is_array check (jsonb_typeof(ticket_prices) = 'array');
  end if;
end $$;

comment on column public.events.ticket_prices is
  'Extra ticket prices (child / vip / ga_early / ga_late / group with group_size), see utils/eventTicketPrices.js. Empty = GA/presale only.';

create or replace view public.events_public
with (security_invoker = on) as
select
  id,
  event_type,
  status,
  title,
  slug,
  description,
  short_description,
  image_url,
  venue_name,
  address,
  suburb,
  state,
  postcode,
  start_date,
  end_date,
  start_time,
  end_time,
  entry_fee_aud,
  is_free,
  website_url,
  ticket_url,
  is_cardpop_verified,
  is_featured,
  registration_required,
  capacity,
  tags,
  featured_card_games,
  seo_title,
  seo_description,
  seo_keywords,
  organizer_name,
  created_at,
  updated_at,
  instagram_url,
  facebook_url,
  youtube_url,
  presale_fee_aud,
  accessibility_info,
  age_restrictions,
  facebook_video_url,
  gallery_images,
  ticket_prices
from public.events
where status in ('approved'::event_status, 'completed'::event_status);
