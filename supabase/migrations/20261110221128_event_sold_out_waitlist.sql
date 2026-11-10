-- Organiser "Sold out" + waitlist link, and the per-ticket booking fee.
--
-- An organiser can mark an event's tickets as sold out and point collectors at
-- the page where they can join the waitlist:
--
--   tickets_sold_out  when true the event page replaces "Get Tickets" with a
--                     disabled "Sold Out" button, and Event JSON-LD
--                     advertises availability SoldOut.
--   waitlist_url      where to join the waitlist (the organiser's own site /
--                     form). Shown as "Join the waitlist" only while the
--                     event is sold out and upcoming.
--
--   booking_fee_aud   the booking / service fee the organiser's ticketing site
--                     adds on top of each ticket (e.g. Humanitix's $3.95), so
--                     the event page can show what a ticket really costs.
--
-- All three are ordinary organiser-editable columns (not pinned by
-- guard_event_organiser_write) and are logged on live edits. events_public is
-- recreated with the columns appended; everything else is
-- 20261110124303_event_homepage_featured.sql.

alter table public.events add column if not exists tickets_sold_out boolean not null default false;
alter table public.events add column if not exists waitlist_url text;
alter table public.events add column if not exists booking_fee_aud numeric(10,2);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'events_booking_fee_nonnegative') then
    alter table public.events
      add constraint events_booking_fee_nonnegative check (booking_fee_aud is null or booking_fee_aud >= 0);
  end if;
end $$;

comment on column public.events.tickets_sold_out is
  'Organiser has marked tickets sold out: the page shows "Sold Out" instead of "Get Tickets" and JSON-LD availability is SoldOut.';
comment on column public.events.waitlist_url is
  'Where collectors join the waitlist for a sold-out event ("Join the waitlist" button, upcoming + sold out only).';

comment on column public.events.booking_fee_aud is
  'Booking / service fee (AUD) the ticketing site adds on top of each ticket; shown as "+ $X booking fee per ticket" on the event page.';

create or replace function public.event_logged_fields()
returns text[]
language sql
immutable
as $$
  select array[
    'title', 'short_description', 'description', 'accessibility_info', 'age_restrictions',
    'event_type', 'featured_card_games', 'image_url', 'gallery_images', 'gallery_albums', 'event_videos',
    'venue_name', 'address', 'suburb', 'state', 'postcode',
    'start_date', 'end_date', 'start_time', 'end_time',
    'organizer_name', 'organizer_logo_url', 'organizer_email', 'organizer_phone',
    'website_url', 'ticket_url', 'vendor_application_url', 'tickets_sold_out', 'waitlist_url', 'booking_fee_aud',
    'instagram_url', 'facebook_url', 'youtube_url', 'youtube_channel_url', 'tiktok_url', 'x_url', 'discord_url',
    'facebook_video_url',
    'entry_fee_aud', 'presale_fee_aud', 'ticket_prices', 'is_free', 'capacity', 'registration_required',
    'seo_title', 'seo_description', 'seo_keywords', 'tags', 'source_url'
  ]::text[]
$$;

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
  ticket_prices,
  gallery_albums,
  event_videos,
  youtube_channel_url,
  tiktok_url,
  x_url,
  discord_url,
  vendor_application_url,
  organizer_logo_url,
  homepage_featured,
  tickets_sold_out,
  waitlist_url,
  booking_fee_aud
from public.events
where status in ('approved'::event_status, 'completed'::event_status);
