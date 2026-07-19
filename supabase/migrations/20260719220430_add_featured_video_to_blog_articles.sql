-- Featured video for blog articles.
--
-- Admins can now provide a featured VIDEO (YouTube / Vimeo URL) as an
-- alternative to the featured image in the article hero. When set, the article
-- page embeds the player in the space the featured image would occupy; the
-- featured image is still used as the poster/thumbnail on blog listing cards
-- (and as the og:image), so the two fields complement rather than replace each
-- other.
--
-- Nullable + additive + idempotent: safe to land before the app that reads it.

alter table public.blog_articles
  add column if not exists featured_video_url text;

comment on column public.blog_articles.featured_video_url is
  'Optional YouTube or Vimeo URL. When set, the article page embeds this video in place of the featured image. featured_image_url is still used as the card thumbnail/poster and og:image.';
