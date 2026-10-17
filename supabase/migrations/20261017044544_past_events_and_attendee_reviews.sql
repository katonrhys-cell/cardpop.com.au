-- Past events stay on the site, and the people who went can review them.
--
-- 1. Visibility. The public SELECT policy on events and the events_public view
--    both admitted `approved` rows only, so the moment an admin marked a show
--    `completed` (the admin's "archive") its page 404'd and it vanished from
--    every list. Both now admit `completed` as well. The calendar still opens
--    on today → next year (upcoming, approved), with a "Past events" toggle
--    that flips the window backwards — see pages/community/CommunityEventsPage.jsx
--    and utils/eventPast.js. `pending_review`, `rejected` and `cancelled`
--    stay hidden.
--
-- 2. Attendee reviews. event_attendee_reviews is a signed-in collector's
--    star rating + write-up of an event they went to: one per person per
--    event, allowed only once the event is over (status `completed`, or its
--    last day is behind us in Australian time). Distinct from event_reviews,
--    which is CardPop's own editorial review (an admin-written article).
--
--    The DB owns the rules, in the same stance as the shop reviews: a BEFORE
--    INSERT trigger checks the event is public and has ended, snapshots the
--    reviewer's name, and forces the moderation columns — a client can't hide
--    or un-hide a review. Reviews publish immediately (like forum posts);
--    admins can hide one (`is_visible = false`) or delete it, and every new
--    review bells the admins so they see it.

-- ── 1. Completed events are public ─────────────────────────────────────────
do $$ begin
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'events'
       and policyname = 'Public can view approved events'
  ) then
    alter policy "Public can view approved events" on public.events
      using (status in ('approved'::event_status, 'completed'::event_status));
  else
    create policy "Public can view approved events" on public.events
      for select using (status in ('approved'::event_status, 'completed'::event_status));
  end if;
end $$;

-- Same column list as 20260719030140_add_events_facebook_video_url.sql (a
-- `create or replace view` may add trailing columns but never drop or reorder).
create or replace view public.events_public
with (security_invoker = on) as
select
  id,
  event_type,
  status,
  title,
  slug,
  description,
  short_description,
  image_url,
  venue_name,
  address,
  suburb,
  state,
  postcode,
  start_date,
  end_date,
  start_time,
  end_time,
  entry_fee_aud,
  is_free,
  website_url,
  ticket_url,
  is_cardpop_verified,
  is_featured,
  registration_required,
  capacity,
  tags,
  featured_card_games,
  seo_title,
  seo_description,
  seo_keywords,
  organizer_name,
  created_at,
  updated_at,
  instagram_url,
  facebook_url,
  youtube_url,
  presale_fee_aud,
  accessibility_info,
  age_restrictions,
  facebook_video_url
from public.events
where status in ('approved'::event_status, 'completed'::event_status);

-- The past-events window reads both statuses by start_date (the existing
-- events_approved_start_idx covers approved only).
create index if not exists events_public_start_idx
  on public.events (start_date)
  where status in ('approved'::event_status, 'completed'::event_status);

-- ── 2. Attendee reviews ─────────────────────────────────────────────────────
create table if not exists public.event_attendee_reviews (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  reviewer_id   uuid not null references public.profiles(id) on delete cascade,
  reviewer_name text not null default 'CardPop collector',
  rating        smallint not null check (rating between 1 and 5),
  title         text check (title is null or char_length(title) <= 120),
  body          text not null check (char_length(body) between 10 and 2000),
  is_visible    boolean not null default true,
  hidden_by     uuid references public.profiles(id) on delete set null,
  hidden_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint event_attendee_reviews_one_per_person unique (event_id, reviewer_id)
);

create index if not exists event_attendee_reviews_event_idx
  on public.event_attendee_reviews (event_id, created_at desc) where is_visible;
create index if not exists event_attendee_reviews_reviewer_idx
  on public.event_attendee_reviews (reviewer_id);

-- "Has this event finished?" in one place for the DB. Australian local date,
-- not UTC: a Sunday show is over on Sunday night in Sydney, which is still
-- Sunday morning in UTC.
create or replace function public.event_has_ended(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
     where e.id = p_event_id
       and e.status in ('approved'::event_status, 'completed'::event_status)
       and (
         e.status = 'completed'::event_status
         or coalesce(e.end_date, e.start_date) < (now() at time zone 'Australia/Sydney')::date
       )
  );
$$;

revoke all on function public.event_has_ended(uuid) from public;
grant execute on function public.event_has_ended(uuid) to anon, authenticated;

create or replace function public.event_attendee_reviews_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.event_has_ended(new.event_id) then
    raise exception 'You can review an event once it has finished'
      using errcode = '22023';
  end if;

  select nullif(btrim(coalesce(p.display_name, p.username, '')), '') into v_name
    from public.profiles p where p.id = new.reviewer_id;
  new.reviewer_name := left(coalesce(v_name, 'CardPop collector'), 60);

  -- Moderation is the DB's (and the admins'), never the client's.
  new.is_visible := true;
  new.hidden_by := null;
  new.hidden_at := null;
  new.title := nullif(btrim(new.title), '');
  new.body := btrim(new.body);
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_event_attendee_reviews_before_insert on public.event_attendee_reviews;
create trigger trg_event_attendee_reviews_before_insert
  before insert on public.event_attendee_reviews
  for each row execute function public.event_attendee_reviews_before_insert();

-- An author may edit their stars and words; only an admin may hide/unhide.
-- The row's identity (event, reviewer) never changes.
create or replace function public.event_attendee_reviews_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and is_admin = true
  ) into v_is_admin;

  new.event_id := old.event_id;
  new.reviewer_id := old.reviewer_id;
  new.reviewer_name := old.reviewer_name;
  new.created_at := old.created_at;

  if coalesce(v_is_admin, false) then
    if new.is_visible is distinct from old.is_visible then
      new.hidden_by := case when new.is_visible then null else (select auth.uid()) end;
      new.hidden_at := case when new.is_visible then null else now() end;
    end if;
  else
    new.is_visible := old.is_visible;
    new.hidden_by := old.hidden_by;
    new.hidden_at := old.hidden_at;
  end if;

  new.title := nullif(btrim(new.title), '');
  new.body := btrim(new.body);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_event_attendee_reviews_before_update on public.event_attendee_reviews;
create trigger trg_event_attendee_reviews_before_update
  before update on public.event_attendee_reviews
  for each row execute function public.event_attendee_reviews_before_update();

-- ── Tell the admins a review landed ─────────────────────────────────────────
alter type notification_type add value if not exists 'event_review_posted';

create or replace function public.notify_admins_event_attendee_review()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event record;
  v_admin record;
begin
  select title, slug into v_event from public.events where id = new.event_id;
  for v_admin in select id from public.profiles where is_admin = true loop
    perform create_notification(
      v_admin.id, 'event_review_posted',
      'New event review',
      new.reviewer_name || ' left a ' || new.rating::text || '-star review of ' || coalesce(v_event.title, 'an event'),
      '/events/' || coalesce(v_event.slug, new.event_id::text), new.id
    );
  end loop;
  return new;
exception when others then
  -- A notification problem must never block a review.
  return new;
end;
$$;

drop trigger if exists trg_event_attendee_reviews_notify on public.event_attendee_reviews;
create trigger trg_event_attendee_reviews_notify
  after insert on public.event_attendee_reviews
  for each row execute function public.notify_admins_event_attendee_review();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.event_attendee_reviews enable row level security;

drop policy if exists "Visible event reviews are public" on public.event_attendee_reviews;
create policy "Visible event reviews are public"
  on public.event_attendee_reviews for select
  using (is_visible = true);

drop policy if exists "Reviewers can read their own event reviews" on public.event_attendee_reviews;
create policy "Reviewers can read their own event reviews"
  on public.event_attendee_reviews for select
  to authenticated
  using (reviewer_id = (select auth.uid()));

drop policy if exists "Admins can read every event review" on public.event_attendee_reviews;
create policy "Admins can read every event review"
  on public.event_attendee_reviews for select
  to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Signed-in users can review a past event" on public.event_attendee_reviews;
create policy "Signed-in users can review a past event"
  on public.event_attendee_reviews for insert
  to authenticated
  with check (reviewer_id = (select auth.uid()));

drop policy if exists "Reviewers can edit their own event reviews" on public.event_attendee_reviews;
create policy "Reviewers can edit their own event reviews"
  on public.event_attendee_reviews for update
  to authenticated
  using (reviewer_id = (select auth.uid()))
  with check (reviewer_id = (select auth.uid()));

drop policy if exists "Admins can moderate event reviews" on public.event_attendee_reviews;
create policy "Admins can moderate event reviews"
  on public.event_attendee_reviews for update
  to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Reviewers and admins can delete event reviews" on public.event_attendee_reviews;
create policy "Reviewers and admins can delete event reviews"
  on public.event_attendee_reviews for delete
  to authenticated
  using (
    reviewer_id = (select auth.uid())
    or exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
  );

grant select on public.event_attendee_reviews to anon, authenticated;
grant insert, update, delete on public.event_attendee_reviews to authenticated;

-- Star summary per event, visible reviews only. Cards and the event page
-- read this instead of pulling every review to average it client-side.
create or replace view public.event_attendee_review_stats
with (security_invoker = true) as
  select event_id,
         count(*)::int                  as review_count,
         round(avg(rating)::numeric, 1) as average_rating
    from public.event_attendee_reviews
   where is_visible
   group by event_id;

grant select on public.event_attendee_review_stats to anon, authenticated;

comment on table public.event_attendee_reviews is
  'Collector reviews of past events (one per person per event). Insert guarded by event_has_ended(); moderation columns forced by trigger; admins hide/delete.';
