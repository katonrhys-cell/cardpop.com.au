-- Minimal stand-in for public.blog_articles (created in the dashboard before
-- the repo tracked migrations) with the columns the published_at migration
-- touches, plus the pre-existing updated_at trigger it must coexist with.
create table public.blog_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.update_blog_articles_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
create trigger trg_blog_articles_updated_at before update on public.blog_articles
  for each row execute function public.update_blog_articles_updated_at();

-- Rows that exist before the migration: a published article with no date
-- (the bug) and two correct ones.
insert into public.blog_articles (slug, is_published, published_at, created_at, updated_at) values
  ('undated-published', true,  null,         '2026-10-31', '2026-11-05 10:42'),
  ('dated-published',   true,  '2026-06-01', '2026-05-30', '2026-07-01'),
  ('draft',             false, null,         '2026-11-01', '2026-11-01');
