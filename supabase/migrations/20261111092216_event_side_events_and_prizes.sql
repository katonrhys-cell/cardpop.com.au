-- Side events + prizes on the event page.
--
-- A card show rarely runs one tournament: Flesh and Blood's "The Calling:
-- Sydney" has a Friday of side events, a Saturday Classic Constructed, a
-- Sunday Silver Age showdown, and a prize table. Organisers (and admins) can
-- now publish both on the event itself.
--
--   side_events  jsonb  [{ title, date, start_time, end_time, entry_fee_aud,
--                          player_cap, description, url }] in display order —
--                       the event's schedule of tournaments / side events.
--                       Shape, limits and cleaning: utils/eventSideEvents.js.
--   event_prizes jsonb  [{ place, reward, images: [url] }] in display order —
--                       e.g. "1st Place" / "$1,500 USD + a Pro Tour Invitation"
--                       with photos of the cards up for grabs (or won).
--                       Shape and cleaning: utils/eventPrizes.js.
--   prize_pool   text   the headline total ("$5,000 USD + participation packs").
--
-- All three are ordinary organiser-editable columns (guard_event_organiser_write
-- does not pin them), logged on live edits via event_logged_fields(), and read
-- by the public page through events_public. The view is recreated with the
-- columns appended; everything else is 20261110221128_event_sold_out_waitlist.sql.

alter table public.events add column if not exists side_events jsonb not null default '[]'::jsonb;
alter table public.events add column if not exists event_prizes jsonb not null default '[]'::jsonb;
alter table public.events add column if not exists prize_pool text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'events_side_events_is_array') then
    alter table public.events
      add constraint events_side_events_is_array check (jsonb_typeof(side_events) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_event_prizes_is_array') then
    alter table public.events
      add constraint events_event_prizes_is_array check (jsonb_typeof(event_prizes) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_prize_pool_length') then
    alter table public.events
      add constraint events_prize_pool_length check (prize_pool is null or char_length(prize_pool) <= 200);
  end if;
end $$;

comment on column public.events.side_events is
  'Side events / tournaments within the event ([{title, date, start_time, end_time, entry_fee_aud, player_cap, description, url}], see utils/eventSideEvents.js). Empty = none.';
comment on column public.events.event_prizes is
  'Prize table ([{place, reward, images[]}], see utils/eventPrizes.js), shown above the event videos. Empty = none.';
comment on column public.events.prize_pool is
  'Headline prize total, free text (max 200 chars), shown above the prize table.';

create or replace function public.event_logged_fields()
returns text[]
language sql
immutable
as $$
  select array[
    'title', 'short_description', 'description', 'accessibility_info', 'age_restrictions',
    'event_type', 'featured_card_games', 'image_url', 'gallery_images', 'gallery_albums', 'event_videos',
    'side_events', 'event_prizes', 'prize_pool',
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
  booking_fee_aud,
  side_events,
  event_prizes,
  prize_pool
from public.events
where status in ('approved'::event_status, 'completed'::event_status);
