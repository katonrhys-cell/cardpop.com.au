-- Behavioural checks for the event-views migration. Raises on the first failure.
\set ON_ERROR_STOP on
create or replace function pg_temp.fail(msg text) returns void language plpgsql as
$$ begin raise exception 'TEST FAILED: %', msg; end $$;

insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', false),  -- owner
  ('00000000-0000-0000-0000-0000000000b2', false),  -- other member
  ('00000000-0000-0000-0000-0000000000ad', true);   -- admin
insert into public.events (id, organiser_id, status) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'approved'),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'pending_review'),
  ('11111111-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b2', 'approved');

-- ── Anonymous visitors count; non-public events don't ───────────────────────
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public.record_event_view('11111111-0000-0000-0000-000000000001');
select public.record_event_view('11111111-0000-0000-0000-000000000001');
select public.record_event_view('11111111-0000-0000-0000-000000000002');  -- pending: ignored
select public.record_event_view('11111111-0000-0000-0000-000000000009');  -- unknown: ignored
select public.record_event_view(null);

-- Anon can't read or write the table directly.
do $$ begin
  begin perform 1 from public.event_views_daily; perform pg_temp.fail('anon read the table');
  exception when insufficient_privilege then null; end;
  begin insert into public.event_views_daily values ('11111111-0000-0000-0000-000000000001', current_date, 99);
        perform pg_temp.fail('anon wrote the table');
  exception when insufficient_privilege then null; end;
end $$;

-- ── The owner's own visits and an admin's aren't counted ────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select public.record_event_view('11111111-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select public.record_event_view('11111111-0000-0000-0000-000000000001');
-- Another signed-in member does count.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select public.record_event_view('11111111-0000-0000-0000-000000000001');
select public.record_event_view('11111111-0000-0000-0000-000000000003');  -- their own event: ignored

-- ── Owner reads the totals of their own event only ──────────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$ declare r record; n int; begin
  select * into r from public.event_view_stats(array[
    '11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003']::uuid[]);
  if r.event_id <> '11111111-0000-0000-0000-000000000001' or r.total <> 3 or r.last_7 <> 3 or r.last_30 <> 3 then
    perform pg_temp.fail('owner stats wrong: ' || coalesce(r::text, 'null'));
  end if;
  select count(*) into n from public.event_view_stats(array['11111111-0000-0000-0000-000000000003']::uuid[]);
  if n <> 0 then perform pg_temp.fail('owner saw another organiser''s event stats'); end if;
  select count(*) into n from public.event_views_daily;
  if n <> 1 then perform pg_temp.fail('owner table select saw ' || n || ' rows'); end if;
end $$;

-- ── A stranger sees nothing; a signed-out caller sees nothing ───────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
do $$ declare n int; begin
  select count(*) into n from public.event_view_stats(array['11111111-0000-0000-0000-000000000001']::uuid[]);
  if n <> 0 then perform pg_temp.fail('a stranger read another event''s stats'); end if;
  select count(*) into n from public.event_views_daily;
  if n <> 0 then perform pg_temp.fail('a stranger selected view rows'); end if;
end $$;

-- ── Admin sees any event ────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
do $$ declare n int; begin
  select count(*) into n from public.event_view_stats(array['11111111-0000-0000-0000-000000000001']::uuid[]);
  if n <> 1 then perform pg_temp.fail('admin could not read stats'); end if;
end $$;

-- ── Signed-out callers can't read stats at all ──────────────────────────────
reset role;
do $$ begin
  begin set role anon; perform * from public.event_view_stats(array['11111111-0000-0000-0000-000000000001']::uuid[]);
        perform pg_temp.fail('anon could execute event_view_stats');
  exception when insufficient_privilege then null; end;
  reset role;
end $$;

\echo 'event views migration: all checks passed'
