-- Set the featured video on the LeBron → Philadelphia article.
--
-- The article and the featured_video_url column already exist in production
-- (migrations 20260719215606 and 20260719220430). This just populates the
-- video URL, the same way an admin would via the article editor — the URL is
-- stored raw (the ?si= share tag is harmless; utils/videoEmbed.js derives the
-- youtube-nocookie embed at render time). Idempotent: scoped to the slug and
-- safe to re-run.

update public.blog_articles
set featured_video_url = 'https://youtu.be/R5K2akS3sXY?si=VMEFzJHlNPCFV6Mb',
    updated_at = now()
where slug = 'why-philadelphia-76ers-could-land-lebron-james-2026';
