-- Daily views of one event, for the owner's trend chart (Account → My Events).
--
-- Returns one row per day for the last p_days (default 30, clamped to 1–90)
-- ending today (Australia/Sydney), zero-filled, oldest first. Like
-- event_view_stats() it re-checks ownership itself: the event's organiser, or an
-- admin — anyone else (or a signed-out caller) gets no rows.
--
-- docs/event-views.md

create or replace function public.event_view_series(p_event_id uuid, p_days integer default 30)
returns table (day date, views bigint)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select (select auth.uid()) as uid,
           (now() at time zone 'Australia/Sydney')::date as today,
           least(greatest(coalesce(p_days, 30), 1), 90) as n
  ),
  allowed as (
    select 1
      from public.events e
      cross join me
     where e.id = p_event_id
       and me.uid is not null
       and (
         e.organiser_id = me.uid
         or exists (select 1 from public.profiles p where p.id = me.uid and p.is_admin = true)
       )
  )
  select d::date as day,
         coalesce(v.views, 0)::bigint as views
    from me
   cross join lateral generate_series(me.today - (me.n - 1), me.today, interval '1 day') as d
    left join public.event_views_daily v
      on v.event_id = p_event_id and v.day = d::date
   where exists (select 1 from allowed)
   order by d;
$$;

revoke all on function public.event_view_series(uuid, integer) from public;
grant execute on function public.event_view_series(uuid, integer) to authenticated;
