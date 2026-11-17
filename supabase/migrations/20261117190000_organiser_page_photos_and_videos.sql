-- Organiser pages can show photos and videos from their previous events, like
-- an event page does: albums of photos (same shape as events.gallery_albums,
-- [{title, images[]}]) and YouTube videos (same shape as events.event_videos,
-- [{title, url}]). Both are ordinary public-profile columns — the owner guard
-- trigger only pins name / slug / owner / created_at, so the page's owner (or
-- an admin) edits them through the existing update policy.
alter table public.event_organisers
  add column if not exists gallery_albums jsonb not null default '[]'::jsonb
    check (jsonb_typeof(gallery_albums) = 'array' and jsonb_array_length(gallery_albums) <= 12),
  add column if not exists videos jsonb not null default '[]'::jsonb
    check (jsonb_typeof(videos) = 'array' and jsonb_array_length(videos) <= 12);

comment on column public.event_organisers.gallery_albums is
  'Photo albums from past events, [{title, images[]}], display order. Normalised by cleanGalleryAlbums() (utils/eventGallery.js).';
comment on column public.event_organisers.videos is
  'YouTube videos from past events, [{title, url}], display order. Normalised by cleanEventVideos() (utils/eventVideos.js).';
