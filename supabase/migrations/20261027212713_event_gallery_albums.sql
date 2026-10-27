-- Event photo albums: the event page's photo gallery can now be grouped —
-- by year ("2025", "2024"), by day, by theme ("Vendors", "Pickups") — so an
-- event that runs every year keeps each year's photos together instead of
-- one growing pile. Shape, limits and the fallback live in
-- utils/eventGallery.js:
--   [{ "title": "2025", "images": ["https://…/events/gallery/….jpg", …] }]
-- Album order is display order (put the latest year first); image order is
-- display order within the album.
--
-- `gallery_images` (20261027110841_event_gallery_images.sql) stays as the
-- flattened list of every album's photos: the event form writes both on every
-- save, and this migration folds any existing photos into a single untitled
-- album so nothing disappears when the page starts reading albums.
--
-- events_public is recreated to expose the column (appended — `create or
-- replace view` can't drop or reorder). Everything else is exactly
-- 20261027112331_event_ticket_prices.sql.

alter table public.events
  add column if not exists gallery_albums jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_gallery_albums_is_array') then
    alter table public.events
      add constraint events_gallery_albums_is_array check (jsonb_typeof(gallery_albums) = 'array');
  end if;
end $$;

comment on column public.events.gallery_albums is
  'Photo gallery grouped into albums ([{title, images[]}], see utils/eventGallery.js). gallery_images is the flattened copy. Empty = no gallery.';

-- Existing galleries become one untitled album (idempotent: only rows that
-- have photos but no albums yet).
update public.events
set gallery_albums = jsonb_build_array(jsonb_build_object('title', '', 'images', to_jsonb(gallery_images)))
where cardinality(gallery_images) > 0
  and gallery_albums = '[]'::jsonb;

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
  gallery_albums
from public.events
where status in ('approved'::event_status, 'completed'::event_status);
