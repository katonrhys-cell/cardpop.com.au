-- Add an optional YouTube video URL to events. Admins paste a video link on an
-- event and the event detail page embeds it, plus emits schema.org VideoObject
-- structured data for SEO (video rich results).
--
-- events_public is the anon-facing view the frontend reads (approved events,
-- public-safe columns only), so it must be recreated to expose the new column.
-- It was created with security_invoker=on; keep that intact.

alter table public.events add column if not exists youtube_url text;

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
  youtube_url
from public.events
where status = 'approved'::event_status;
