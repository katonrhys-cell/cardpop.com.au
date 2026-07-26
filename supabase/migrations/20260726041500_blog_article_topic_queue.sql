-- Scheduled blog article generation.
--
-- blog_article_topics is the planning queue the daily cron draws from: one row
-- per article we intend to publish, carrying the brief, the SEO keywords and
-- the tracked cards whose price snapshots the article must cite. The generator
-- picks the highest-priority queued topic whose data gate is satisfied, writes
-- a draft into blog_articles, and marks the topic generated.
--
-- Topics are planning data, not public content — no public read policy. All
-- access is via the backend service-role client.

create table if not exists public.blog_article_topics (
  id uuid primary key default gen_random_uuid(),
  -- Planned slug for the article. Unique so the same topic can't be queued
  -- twice, and so a re-run can't collide with an already-published article.
  slug text not null unique,
  title_hint text not null,
  brief text not null,
  category text not null,
  -- SEO terms the article should rank for; the first entry is the primary.
  keywords text[] not null default '{}',
  -- Feeds blog_articles.marketplace_keywords → the "Shop Cards From This
  -- Article" live-listings module.
  marketplace_keywords text[] not null default '{}',
  -- tracked_cards.slug values whose snapshots are handed to the model as the
  -- article's factual base. Empty = no price data (explainer/evergreen piece).
  tracked_card_slugs text[] not null default '{}',
  author text not null default 'CardPop Research Team',
  -- Lower runs first.
  priority integer not null default 100,
  -- Data gate: don't generate until every referenced card has at least this
  -- many days of snapshots, so the article can make a defensible claim about
  -- the window it quotes.
  min_snapshot_days integer not null default 7,
  status text not null default 'queued'
    check (status in ('queued', 'generating', 'generated', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  article_id uuid references public.blog_articles(id) on delete set null,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The cron's selection query: queued topics, best priority first.
create index if not exists blog_article_topics_queue_idx
  on public.blog_article_topics (priority, created_at)
  where status = 'queued';

-- Mark generated articles so the admin list can distinguish them from
-- hand-written ones, and so a human review step can filter to them.
alter table public.blog_articles
  add column if not exists auto_generated boolean not null default false;

alter table public.blog_articles
  add column if not exists generation_model text;

alter table public.blog_article_topics enable row level security;

-- No public policies: the backend uses the service-role key (bypasses RLS).
-- Admins may read the queue from the client for the admin UI.
drop policy if exists "Admins can read blog article topics" on public.blog_article_topics;
create policy "Admins can read blog article topics"
  on public.blog_article_topics for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
