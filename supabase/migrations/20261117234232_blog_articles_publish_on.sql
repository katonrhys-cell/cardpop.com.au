-- Scheduled publishing for blog articles.
--
-- Publishing was an on/off switch that went live immediately, which is how four
-- articles ended up stamped the same second — exactly the batch-publishing
-- pattern docs/adsense-readiness.md warns about. An admin can now give a draft
-- a date (Admin → Content → Schedule) and the daily blog run
-- (api/blog-generate.js → src/utils/blogScheduledPublish.js, 07:07 AEST)
-- publishes every draft whose date has arrived.
--
-- `publish_on` is a calendar date in Australian (Sydney) time, not a
-- timestamp: the run happens once a day, so a time of day would promise a
-- precision the system doesn't have. It is cleared when the article goes live
-- by any route. Drafts are readable by admins only (RLS), so the date is never
-- public.

alter table public.blog_articles
  add column if not exists publish_on date;

comment on column public.blog_articles.publish_on is
  'Australian date a draft is due to go live; published by the daily blog run. Null = not scheduled.';

-- The daily run reads only scheduled drafts.
create index if not exists blog_articles_publish_on_idx
  on public.blog_articles (publish_on)
  where publish_on is not null and not is_published;

-- A published article has no pending schedule, whoever published it.
create or replace function public.blog_articles_clear_publish_on()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_published then
    new.publish_on := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_blog_articles_clear_publish_on on public.blog_articles;
create trigger trg_blog_articles_clear_publish_on
  before insert or update of is_published, publish_on on public.blog_articles
  for each row execute function public.blog_articles_clear_publish_on();
