-- Event organiser logo: the organiser's brand mark — a still image or a
-- "moving" one (animated GIF / animated WebP, or a short muted MP4 / WebM
-- loop) — shown on the event page beside the title, above Event Details.
-- Uploaded from the event form's Organiser tab into the `events` bucket under
-- logos/<uuid>.<ext> (utils/uploadEventOrganiserLogo.js); the column holds the
-- public URL. NULL = no logo, the title keeps the full width.
--
-- events_public is recreated to expose the column (appended — `create or
-- replace view` can't drop or reorder, so the five organiser-link columns
-- 20261029020720_event_organiser_links.sql added must stay in the list).
-- Everything else is exactly that migration.

alter table public.events
  add column if not exists organizer_logo_url text;

comment on column public.events.organizer_logo_url is
  'Organiser logo shown beside the event title (image, animated GIF/WebP, or a short MP4/WebM loop). Public URL in the events bucket, logos/<uuid>.<ext> — see utils/eventOrganiserLogo.js.';

-- The bucket was image-only; a moving logo may be a short video loop. Keep the
-- existing types and add the two video containers browsers play inline.
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct t)
  from unnest(coalesce(allowed_mime_types, '{}'::text[]) || array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']) as t
)
where id = 'events';

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
  organizer_logo_url
from public.events
where status in ('approved'::event_status, 'completed'::event_status);
