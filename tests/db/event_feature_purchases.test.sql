-- Behavioural checks for 20261110104532_event_feature_purchases.sql.
-- Run by tests/db/run-event-feature-purchases-migration.sh.
\set ON_ERROR_STOP on

insert into public.profiles (id, display_name, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', true),
  ('00000000-0000-0000-0000-0000000000b1', 'Organiser', false),
  ('00000000-0000-0000-0000-0000000000c1', 'Someone else', false);

insert into public.events (id, organiser_id, title, status, start_date) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'Show', 'approved', '2026-12-20');

-- The service role (no JWT) writes purchases.
insert into public.event_feature_purchases (event_id, organiser_id, package, base_aud, amount_aud, status, stripe_session_id)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'full', 149, 149, 'paid', 'cs_1');

do $$ begin
  begin
    insert into public.event_feature_purchases (event_id, organiser_id, package, base_aud, amount_aud, status)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'spotlight', 49, 49, 'paid');
    raise exception 'a second paid featuring for one event must be refused';
  exception when unique_violation then null;
  end;
  begin
    insert into public.event_feature_purchases (event_id, organiser_id, package, base_aud, amount_aud)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'gold', 1, 1);
    raise exception 'an unknown package must be refused';
  exception when check_violation then null;
  end;
end $$;

-- A pending retry alongside the paid row is allowed (only one *paid*).
insert into public.event_feature_purchases (event_id, organiser_id, package, base_aud, amount_aud)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'spotlight', 49, 49);

set role authenticated;

-- The organiser reads their own rows, and cannot write.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
do $$ begin
  assert (select count(*) from public.event_feature_purchases) = 2, 'organiser sees their purchases';
  begin
    insert into public.event_feature_purchases (event_id, organiser_id, package, base_aud, amount_aud, status)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'full', 0, 0, 'paid');
    raise exception 'the browser must not be able to record a purchase';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.event_feature_purchases set status = 'paid';
    raise exception 'the browser must not be able to mark a purchase paid';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Someone else sees nothing; an admin sees everything.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$ begin
  assert (select count(*) from public.event_feature_purchases) = 0, 'other members see no purchases';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$ begin
  assert (select count(*) from public.event_feature_purchases) = 2, 'admins see every purchase';
end $$;

reset role;
\echo 'event_feature_purchases: all checks passed'
