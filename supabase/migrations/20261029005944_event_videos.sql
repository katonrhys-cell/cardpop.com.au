-- Event videos: an event page can now embed several YouTube videos — the
-- organiser's recap, a vendor walkthrough, last year's highlights — shown
-- below the photo gallery, the first one starting by itself (muted) a few
-- seconds after the page opens. Shape, limits and the fallback live in
-- utils/eventVideos.js:
--   [{ "title": "2025 recap", "url": "https://www.youtube.com/watch?v=…" }]
-- List order is display order (put the best one first — it autoplays).
--
-- `youtube_url` (20260716104952_add_events_youtube_url.sql) stays as the
-- first video's URL: the event form writes both on every save, and this
-- migration folds any existing youtube_url into a one-item list so nothing
-- disappears when the page starts reading the list.
--
-- events_public is recreated to expose the column (appended — `create or
-- replace view` can't drop or reorder). Everything else is exactly
-- 20261027212713_event_gallery_albums.sql.

alter table public.events
  add column if not exists event_videos jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_event_videos_is_array') then
    alter table public.events
      add constraint events_event_videos_is_array check (jsonb_typeof(event_videos) = 'array');
  end if;
end $$;

comment on column public.events.event_videos is
  'YouTube videos embedded on the event page below the photos ([{title, url}], see utils/eventVideos.js). youtube_url is the first one. Empty = no videos.';

-- An existing single video becomes a one-item list (idempotent: only rows
-- that have a youtube_url but no list yet).
update public.events
set event_videos = jsonb_build_array(jsonb_build_object('title', '', 'url', youtube_url))
where youtube_url is not null
  and btrim(youtube_url) <> ''
  and event_videos = '[]'::jsonb;

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
  event_videos
from public.events
where status in ('approved'::event_status, 'completed'::event_status);
