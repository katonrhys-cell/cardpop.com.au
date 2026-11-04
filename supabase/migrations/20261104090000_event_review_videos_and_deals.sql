-- Event reviews: several videos, and deals of the day.
--
-- `videos` is an array of the same {url, poster_url, caption} objects the single
-- `video` column holds, in display order (utils/eventReview.js cleanVideos()).
-- `video` stays and mirrors videos[0] — written on every save by
-- normalizeReview() — so anything still reading the old column keeps working.
--
-- `deals` is the "deals of the day" list: the bargains vendors were running at
-- the show — [{title, vendor, price_aud, was_price_aud, note, url, image_url}]
-- (cleanDeals()). Both are optional: a review can still be just stars, just
-- photos, just videos, just deals or just the written report.

alter table public.event_reviews
  add column if not exists videos jsonb not null default '[]'::jsonb,
  add column if not exists deals  jsonb not null default '[]'::jsonb;

comment on column public.event_reviews.videos is
  'Review videos in display order: [{url, poster_url, caption}]. url = media-bucket upload or a YouTube/Vimeo link. video mirrors videos[0].';
comment on column public.event_reviews.deals is
  'Deals of the day: [{title, vendor, price_aud, was_price_aud, note, url, image_url}].';

-- Carry the existing single video over (idempotent: only rows not yet migrated).
update public.event_reviews
set videos = jsonb_build_array(video)
where video is not null
  and jsonb_typeof(video) = 'object'
  and videos = '[]'::jsonb;

alter table public.event_reviews
  drop constraint if exists event_reviews_videos_is_array,
  add constraint event_reviews_videos_is_array check (jsonb_typeof(videos) = 'array'),
  drop constraint if exists event_reviews_deals_is_array,
  add constraint event_reviews_deals_is_array check (jsonb_typeof(deals) = 'array');
