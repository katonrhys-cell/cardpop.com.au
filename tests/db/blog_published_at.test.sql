-- Checks for 20261105105257_blog_articles_stamp_published_at.sql.
\set ON_ERROR_STOP 1
do $$
declare r record;
begin
  -- Backfill: the undated published row takes its updated_at; others untouched.
  select * into r from public.blog_articles where slug = 'undated-published';
  if r.published_at is distinct from '2026-11-05 10:42'::timestamptz then raise exception 'FAIL backfill: %', r.published_at; end if;
  select * into r from public.blog_articles where slug = 'dated-published';
  if r.published_at is distinct from '2026-06-01'::timestamptz then raise exception 'FAIL kept date: %', r.published_at; end if;
  select * into r from public.blog_articles where slug = 'draft';
  if r.published_at is not null then raise exception 'FAIL draft got a date'; end if;
end $$;

-- Publishing a draft the way Admin → Blog's toggle did (flag only) stamps now().
update public.blog_articles set is_published = true where slug = 'draft';
do $$ begin
  if (select published_at from public.blog_articles where slug = 'draft') is null then raise exception 'FAIL publish not stamped'; end if;
end $$;

-- Unpublish keeps the date; re-publish keeps the original date.
update public.blog_articles set published_at = '2026-01-01' where slug = 'draft';
update public.blog_articles set is_published = false where slug = 'draft';
update public.blog_articles set is_published = true where slug = 'draft';
do $$ begin
  if (select published_at from public.blog_articles where slug = 'draft') is distinct from '2026-01-01'::timestamptz then raise exception 'FAIL re-publish changed date'; end if;
end $$;

-- Inserting an already-published article without a date stamps it; an
-- explicit (backdated) date is kept.
insert into public.blog_articles (slug, is_published) values ('born-published', true);
insert into public.blog_articles (slug, is_published, published_at) values ('backdated', true, '2025-12-25');
do $$ begin
  if (select published_at from public.blog_articles where slug = 'born-published') is null then raise exception 'FAIL insert not stamped'; end if;
  if (select published_at from public.blog_articles where slug = 'backdated') is distinct from '2025-12-25'::timestamptz then raise exception 'FAIL backdate overwritten'; end if;
end $$;

-- Clearing the date on a published article is refilled, never left blank.
update public.blog_articles set published_at = null where slug = 'backdated';
do $$ begin
  if (select published_at from public.blog_articles where slug = 'backdated') is null then raise exception 'FAIL cleared date left blank'; end if;
end $$;

select 'blog_published_at: all checks passed' as result;
