-- A published article always has a publish date.
--
-- Admin → Blog's one-click Publish toggle (ContentManagementPage
-- handleQuickPublish) flipped is_published without setting published_at, so
-- every nightly machine draft published that way went live undated: no
-- datePublished in its Article JSON-LD, no date on the page, and missing from
-- "published in the last 30 days" — the freshness signal AdSense's "ongoing
-- curation" check and Google's article markup both read. Four articles
-- (2026-10-31 → 11-03) were affected.
--
-- The trigger fixes it for every writer (admin UI, generator, SQL), not just
-- the one button. It only fills a missing date; an explicit published_at —
-- including a backdated one — is kept, and unpublishing leaves the date alone
-- so a re-publish keeps its original date.

create or replace function public.blog_articles_stamp_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_published and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_blog_articles_stamp_published_at on public.blog_articles;
create trigger trg_blog_articles_stamp_published_at
  before insert or update of is_published, published_at on public.blog_articles
  for each row execute function public.blog_articles_stamp_published_at();

-- Backfill: the moment an undated article went live is its last update (the
-- publish click) — never later than now, never earlier than it was drafted.
update public.blog_articles
set published_at = coalesce(updated_at, created_at, now())
where is_published and published_at is null;
