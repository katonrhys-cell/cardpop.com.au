-- Event reviews: how many deals CardPop did at the show, and the homepage's
-- "CardPop at events" figures.
--
-- `deals_done` is a whole-number count the admin enters in the review's Quick
-- facts (the buys, sells and trades we did on the day). It is distinct from
-- `deals` — the "deals of the day" list of vendors' bargains.
--
-- public_event_review_stats() totals the published reviews for the homepage
-- stats strip: events attended (one per published review) and deals done (the
-- sum of deals_done). Security definer so the browser and the edge-cached
-- /public/home bundle can read two numbers without row access; it counts only
-- reviews whose article is published, exactly what the RLS policy shows anon.
-- See docs/event-reviews.md.

alter table public.event_reviews
  add column if not exists deals_done integer;

alter table public.event_reviews
  drop constraint if exists event_reviews_deals_done_check,
  add constraint event_reviews_deals_done_check check (deals_done is null or deals_done >= 0);

comment on column public.event_reviews.deals_done is
  'How many deals (buys, sells, trades) CardPop did at the event. Null = not recorded. Summed on the homepage.';

create or replace function public.public_event_review_stats()
returns table (events_attended bigint, deals_done bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(distinct coalesce(r.event_id::text, r.id::text))::bigint as events_attended,
    coalesce(sum(r.deals_done), 0)::bigint as deals_done
  from public.event_reviews r
  join public.blog_articles a on a.id = r.article_id
  where a.is_published = true;
$$;

comment on function public.public_event_review_stats() is
  'Homepage stats: events CardPop attended (published reviews, one per event) and total deals done at them.';

revoke all on function public.public_event_review_stats() from public;
grant execute on function public.public_event_review_stats() to anon, authenticated, service_role;
