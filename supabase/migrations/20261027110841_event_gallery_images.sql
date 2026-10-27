-- Event photo gallery. Admins (and organisers submitting an event) add photos
-- on the event form's Media tab; the event page shows them as a gallery
-- directly below "About this event". Each entry is the canonical public
-- Supabase Storage URL of an image in the `events` bucket
-- (events/gallery/<timestamp>-<n>.<ext>), in display order.
--
-- events_public is the view the event page reads, so it is recreated to
-- expose the new column (trailing — `create or replace view` can append but
-- never drop or reorder). Column list and WHERE clause are otherwise exactly
-- 20261017044544_past_events_and_attendee_reviews.sql.

alter table public.events
  add column if not exists gallery_images text[] not null default '{}';

comment on column public.events.gallery_images is
  'Photo gallery shown below "About this event" — public Storage URLs in display order. Empty = no gallery.';

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
  gallery_images
from public.events
where status in ('approved'::event_status, 'completed'::event_status);
