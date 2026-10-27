-- Event reviews get a video, and the `media` bucket learns to hold one.
--
-- `event_reviews.video` is null or one object:
--   { "url", "poster_url", "caption" }
-- `url` is either a clip uploaded to the `media` bucket
-- (event-reviews/videos/<timestamp>-<name>.<mp4|webm|mov>) or a YouTube / Vimeo
-- link for anything longer than the bucket allows. utils/eventReview.js
-- cleanVideo() is the only writer's shape; see docs/event-reviews.md.
--
-- The rating, the photos, the video and the written report are each optional
-- on their own — publishing needs a title, the event and at least one of them
-- (reviewPublishProblems()). Nothing in the schema forces any of them.

alter table public.event_reviews
  add column if not exists video jsonb;

comment on column public.event_reviews.video is
  'Optional review video: {url, poster_url, caption}. url = media-bucket upload or a YouTube/Vimeo link.';

-- The admin-only media bucket held images and PDFs only. Add the common
-- phone/browser video containers; the existing 50 MB per-object cap stays,
-- so a longer clip goes up as a YouTube/Vimeo link instead.
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct m order by m)
  from unnest(coalesce(allowed_mime_types, array[]::text[])
              || array['video/mp4', 'video/webm', 'video/quicktime']) as m
)
where id = 'media'
  and allowed_mime_types is not null;
