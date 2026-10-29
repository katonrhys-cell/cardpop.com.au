-- Event organiser links: the event form's Organiser tab could link an event
-- to its website, tickets, Instagram and Facebook — but not to the
-- organiser's YouTube channel, TikTok, X (Twitter) or Discord, nor to the
-- page where traders apply for a table. Each is its own nullable column so
-- the public page, the Event JSON-LD (`organizer.sameAs`) and the
-- prerendered copy can read them without parsing anything.
--
--   youtube_channel_url    the organiser's channel — NOT a video. Videos
--                          embedded on the page are events.event_videos /
--                          youtube_url (utils/eventVideos.js).
--   tiktok_url             organiser's TikTok profile
--   x_url                  organiser's X (Twitter) profile
--   discord_url            organiser's Discord invite / server
--   vendor_application_url where dealers / traders book a table
--
-- events_public is recreated to expose the columns (appended — `create or
-- replace view` can't drop or reorder). Everything else is exactly
-- 20261029005944_event_videos.sql.

alter table public.events add column if not exists youtube_channel_url text;
alter table public.events add column if not exists tiktok_url text;
alter table public.events add column if not exists x_url text;
alter table public.events add column if not exists discord_url text;
alter table public.events add column if not exists vendor_application_url text;

comment on column public.events.youtube_channel_url is
  'Organiser''s YouTube channel (a link in "Follow the Organiser"). Not a video — embedded videos are event_videos / youtube_url.';
comment on column public.events.tiktok_url is 'Organiser''s TikTok profile.';
comment on column public.events.x_url is 'Organiser''s X (Twitter) profile.';
comment on column public.events.discord_url is 'Organiser''s Discord invite or server link.';
comment on column public.events.vendor_application_url is
  'Where dealers / traders apply for a table at this event (shown as "Apply for a trader table" while the event is upcoming).';

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
  vendor_application_url
from public.events
where status in ('approved'::event_status, 'completed'::event_status);
