-- Behavioural checks for 20261111032413_event_view_series.sql (runs after
-- event_views.test.sql in the same database). Raises on the first failure.
\set ON_ERROR_STOP on
create or replace function pg_temp.fail(msg text) returns void language plpgsql as
$$ begin raise exception 'TEST FAILED: %', msg; end $$;

insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000c1', false),  -- owner
  ('00000000-0000-0000-0000-0000000000c2', false),  -- stranger
  ('00000000-0000-0000-0000-0000000000cd', true);   -- admin
insert into public.events (id, organiser_id, status) values
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'approved');

-- Views today, 2 days ago, and 40 days ago (outside the default window).
insert into public.event_views_daily (event_id, day, views)
select '22222222-0000-0000-0000-000000000001', (now() at time zone 'Australia/Sydney')::date - off, n
  from (values (0, 5), (2, 3), (40, 99)) as t(off, n);

-- ── Owner: zero-filled, oldest first, ending today ──────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$ declare
  r record; n int := 0; total bigint := 0; prev date; today date := (now() at time zone 'Australia/Sydney')::date;
begin
  for r in select * from public.event_view_series('22222222-0000-0000-0000-000000000001') loop
    n := n + 1; total := total + r.views;
    if prev is not null and r.day <> prev + 1 then perform pg_temp.fail('days not consecutive at ' || r.day); end if;
    prev := r.day;
  end loop;
  if n <> 30 then perform pg_temp.fail('expected 30 rows, got ' || n); end if;
  if prev <> today then perform pg_temp.fail('series should end today, ended ' || prev); end if;
  if total <> 8 then perform pg_temp.fail('expected 8 views in the window (the 40-day-old row is outside), got ' || total); end if;
  if (select views from public.event_view_series('22222222-0000-0000-0000-000000000001') where day = today) <> 5 then
    perform pg_temp.fail('today should show 5');
  end if;
  if (select views from public.event_view_series('22222222-0000-0000-0000-000000000001') where day = today - 1) <> 0 then
    perform pg_temp.fail('a day with no row should be 0');
  end if;
end $$;

-- ── The window is clamped to 1..90, and null means 30 ───────────────────────
do $$ begin
  if (select count(*) from public.event_view_series('22222222-0000-0000-0000-000000000001', 7)) <> 7 then perform pg_temp.fail('7 days'); end if;
  if (select count(*) from public.event_view_series('22222222-0000-0000-0000-000000000001', 0)) <> 1 then perform pg_temp.fail('0 clamps to 1'); end if;
  if (select count(*) from public.event_view_series('22222222-0000-0000-0000-000000000001', -5)) <> 1 then perform pg_temp.fail('negative clamps to 1'); end if;
  if (select count(*) from public.event_view_series('22222222-0000-0000-0000-000000000001', 5000)) <> 90 then perform pg_temp.fail('5000 clamps to 90'); end if;
  if (select count(*) from public.event_view_series('22222222-0000-0000-0000-000000000001', null)) <> 30 then perform pg_temp.fail('null means 30'); end if;
  -- 90 days reaches the 40-day-old row.
  if (select sum(views) from public.event_view_series('22222222-0000-0000-0000-000000000001', 90)) <> 107 then perform pg_temp.fail('90-day total'); end if;
end $$;

-- ── A stranger and an unknown event get nothing ─────────────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
do $$ begin
  if (select count(*) from public.event_view_series('22222222-0000-0000-0000-000000000001')) <> 0 then
    perform pg_temp.fail('a stranger read another organiser''s series');
  end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$ begin
  if (select count(*) from public.event_view_series('99999999-0000-0000-0000-000000000009')) <> 0 then
    perform pg_temp.fail('an unknown event returned rows');
  end if;
end $$;

-- ── An admin reads any event ────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000cd', false);
do $$ begin
  if (select count(*) from public.event_view_series('22222222-0000-0000-0000-000000000001')) <> 30 then
    perform pg_temp.fail('admin could not read the series');
  end if;
end $$;

-- ── Signed-out callers can't execute it ─────────────────────────────────────
reset role;
do $$ begin
  begin
    set role anon;
    perform * from public.event_view_series('22222222-0000-0000-0000-000000000001');
    perform pg_temp.fail('anon could execute event_view_series');
  exception when insufficient_privilege then null; end;
  reset role;
end $$;

\echo 'event view series migration: all checks passed'
