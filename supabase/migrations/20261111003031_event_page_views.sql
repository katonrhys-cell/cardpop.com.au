-- Event page views, visible to the event's owner.
--
-- One row per event per day (Australian time) holding a view count. The
-- counter only moves through record_event_view(), which anyone (signed in or
-- not) may call, and which ignores:
--   * events that aren't public (draft / pending / rejected / cancelled),
--   * the event's own organiser and any admin viewing it — so the number is
--     other people's views, not the organiser refreshing their own page.
-- The browser also de-duplicates to one view per browser per event per day
-- (hooks/useRecordEventView.js); this is a popularity signal, not a billing
-- figure, so there is no per-visitor identity here.
--
-- Reading: the table has no public policy. An organiser reads the totals for
-- the events they own — and admins for any — through event_view_stats(), which
-- re-checks ownership itself, and may select the rows of their own events.
--
-- docs/event-views.md

create table if not exists public.event_views_daily (
  event_id uuid    not null references public.events(id) on delete cascade,
  day      date    not null,
  views    integer not null default 0 check (views >= 0),
  primary key (event_id, day)
);

comment on table public.event_views_daily is
  'Daily page-view counts per public event (Australia/Sydney day). Written only by record_event_view(); read by the event''s organiser and admins.';

alter table public.event_views_daily enable row level security;

drop policy if exists "Organisers and admins read event views" on public.event_views_daily;
create policy "Organisers and admins read event views"
  on public.event_views_daily for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    or exists (
      select 1 from public.events e
       where e.id = event_views_daily.event_id and e.organiser_id = (select auth.uid())
    )
  );

revoke all on public.event_views_daily from anon, authenticated;
grant select on public.event_views_daily to authenticated;

-- ── Recording ───────────────────────────────────────────────────────────────
create or replace function public.record_event_view(p_event_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_event_id is null then
    return;
  end if;

  -- Only public events, and not the organiser looking at their own.
  if not exists (
    select 1 from public.events e
     where e.id = p_event_id
       and e.status in ('approved'::event_status, 'completed'::event_status)
       and (v_uid is null or e.organiser_id is distinct from v_uid)
  ) then
    return;
  end if;

  -- Admins checking an event aren't an audience.
  if v_uid is not null
     and exists (select 1 from public.profiles p where p.id = v_uid and p.is_admin = true) then
    return;
  end if;

  insert into public.event_views_daily as v (event_id, day, views)
  values (p_event_id, (now() at time zone 'Australia/Sydney')::date, 1)
  on conflict (event_id, day) do update set views = v.views + 1;
end;
$$;

revoke all on function public.record_event_view(uuid) from public;
grant execute on function public.record_event_view(uuid) to anon, authenticated;

-- ── Reading ─────────────────────────────────────────────────────────────────
-- Totals for up to 200 events at once. Returns a row only for events the caller
-- owns (or any, for an admin) that have at least one view; the client treats a
-- missing event as zero.
create or replace function public.event_view_stats(p_event_ids uuid[])
returns table (event_id uuid, total bigint, last_7 bigint, last_30 bigint)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select (select auth.uid()) as uid,
           (now() at time zone 'Australia/Sydney')::date as today
  )
  select v.event_id,
         sum(v.views)::bigint,
         coalesce(sum(v.views) filter (where v.day >= me.today - 6), 0)::bigint,
         coalesce(sum(v.views) filter (where v.day >= me.today - 29), 0)::bigint
    from public.event_views_daily v
    join public.events e on e.id = v.event_id
    cross join me
   where v.event_id = any (p_event_ids[1:200])
     and me.uid is not null
     and (
       e.organiser_id = me.uid
       or exists (select 1 from public.profiles p where p.id = me.uid and p.is_admin = true)
     )
   group by v.event_id;
$$;

revoke all on function public.event_view_stats(uuid[]) from public;
grant execute on function public.event_view_stats(uuid[]) to authenticated;
