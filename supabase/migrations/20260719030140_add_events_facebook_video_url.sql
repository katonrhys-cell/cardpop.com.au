-- Add an optional Facebook public post / Reel URL to events. Admins and user
-- submissions paste a public Facebook video post or Reel link on the event
-- form (under the YouTube Video URL field) and the event detail page embeds
-- it under "About this event" — below the YouTube video when both are set.
--
-- events_public is the anon-facing view the frontend reads (approved events,
-- public-safe columns only), so it must be recreated to expose the new
-- column. It was created with security_invoker=on; keep that intact.

alter table public.events add column if not exists facebook_video_url text;

comment on column public.events.facebook_video_url is
  'Public Facebook video post or Reel URL, embedded on the event page via the Facebook plugins player. Null = no Facebook video.';

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
  facebook_video_url
from public.events
where status = 'approved'::event_status;
