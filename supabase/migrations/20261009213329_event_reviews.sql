-- Event reviews: an admin's first-hand write-up of a card show or TCG event.
--
-- A review is a normal blog article (blog_articles, category 'event-reviews')
-- plus one row here carrying the structured parts — the star scorecard, the
-- quick-facts panel, the photo gallery and the pickups/haul list — and the link
-- to the event it reviews. The article page renders those sections around the
-- written story; the event's own page shows a teaser card pointing at the
-- article. See docs/event-reviews.md.
--
-- Visibility follows the article: a review is public exactly when its article
-- is published. Only admins write rows (the same people who can write articles).

create table if not exists public.event_reviews (
  id              uuid primary key default gen_random_uuid(),
  article_id      uuid not null unique references public.blog_articles(id) on delete cascade,
  event_id        uuid references public.events(id) on delete set null,
  author_id       uuid references public.profiles(id) on delete set null,
  attended_on     date,
  -- Overall out of 5 in half-star steps. Stored (not derived) so the admin can
  -- override the average of the sub-scores when the day deserved it.
  overall_rating  numeric(2,1)
                  check (overall_rating is null or (overall_rating >= 0.5 and overall_rating <= 5)),
  -- Sub-scores keyed by utils/eventReview.js SCORE_CATEGORIES ids, e.g.
  -- {"vendors": 4, "prices": 3.5, "venue": 5, "atmosphere": 4.5, "value": 4}.
  scores          jsonb not null default '{}'::jsonb,
  go_again        text check (go_again is null or go_again in ('yes', 'maybe', 'no')),
  verdict         text,
  ticket_paid_aud numeric(10,2) check (ticket_paid_aud is null or ticket_paid_aud >= 0),
  hours_spent     numeric(4,1)  check (hours_spent is null or hours_spent >= 0),
  crowd_level     text check (crowd_level is null or crowd_level in ('quiet', 'steady', 'busy', 'packed')),
  headline_pickup text,
  -- [{ "url", "caption", "alt" }]
  gallery         jsonb not null default '[]'::jsonb,
  -- [{ "name", "price_aud", "url", "image_url", "note" }]
  pickups         jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.event_reviews is
  'Structured half of an event review (scorecard, quick facts, gallery, pickups); the story is the linked blog_articles row.';

create index if not exists idx_event_reviews_event_id on public.event_reviews (event_id);

-- Keep updated_at honest on every write.
create or replace function public.event_reviews_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_event_reviews_touch_updated_at on public.event_reviews;
create trigger trg_event_reviews_touch_updated_at
  before update on public.event_reviews
  for each row execute function public.event_reviews_touch_updated_at();

alter table public.event_reviews enable row level security;

-- Readable when the article is published, or by an admin (drafts in the editor).
drop policy if exists event_reviews_select_access on public.event_reviews;
create policy event_reviews_select_access on public.event_reviews
  for select to public
  using (
    exists (
      select 1 from public.blog_articles a
      where a.id = event_reviews.article_id and a.is_published = true
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

drop policy if exists event_reviews_admin_insert on public.event_reviews;
create policy event_reviews_admin_insert on public.event_reviews
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists event_reviews_admin_update on public.event_reviews;
create policy event_reviews_admin_update on public.event_reviews
  for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists event_reviews_admin_delete on public.event_reviews;
create policy event_reviews_admin_delete on public.event_reviews
  for delete to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

grant select on public.event_reviews to anon, authenticated;
grant insert, update, delete on public.event_reviews to authenticated;
