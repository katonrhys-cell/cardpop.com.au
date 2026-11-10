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

-- ── homepage_featured (20261110124303) ──────────────────────────────────────
-- The guard keys on auth.uid() (event_caller_is_admin()), so each step sets
-- the caller's JWT subject and writes as the table owner, letting the trigger
-- (not RLS) decide.
do $$
declare v boolean;
begin
  -- Service role (no JWT) sets it, and the public view exposes it.
  perform set_config('request.jwt.claim.sub', '', false);
  update public.events set homepage_featured = true where id = '00000000-0000-0000-0000-0000000000e1';
  assert (select homepage_featured from public.events_public where id = '00000000-0000-0000-0000-0000000000e1'),
    'events_public exposes homepage_featured';

  -- The organiser can't switch it off…
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
  update public.events set homepage_featured = false, title = 'Show (edited)' where id = '00000000-0000-0000-0000-0000000000e1';
  select homepage_featured into v from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert v, 'an organiser cannot switch homepage_featured off';
  assert (select title from public.events where id = '00000000-0000-0000-0000-0000000000e1') = 'Show (edited)',
    'the rest of the organiser edit still saves';

  -- …or on, for a new event.
  insert into public.events (id, organiser_id, title, status, start_date, homepage_featured)
  values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b1', 'New', 'pending_review', '2026-12-30', true);
  assert not (select homepage_featured from public.events where id = '00000000-0000-0000-0000-0000000000e2'),
    'an organiser cannot create a homepage-featured event';

  -- An admin can.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
  update public.events set homepage_featured = true where id = '00000000-0000-0000-0000-0000000000e2';
  assert (select homepage_featured from public.events where id = '00000000-0000-0000-0000-0000000000e2'),
    'an admin can set homepage_featured';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
\echo 'homepage_featured: all checks passed'

-- ── 3-event pack (20261110194228) ──────────────────────────────────────────
insert into public.events (id, organiser_id, title, status, start_date) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b1', 'Show 2', 'approved', '2026-12-21'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000b1', 'Show 3', 'approved', '2026-12-22'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000b1', 'Show 4', 'approved', '2026-12-23');

do $$ begin
  perform set_config('request.jwt.claim.sub', '', false);
  -- One session, three rows sharing a bundle.
  insert into public.event_feature_purchases (event_id, organiser_id, package, base_aud, amount_aud, status, stripe_session_id, bundle_id)
  select e, '00000000-0000-0000-0000-0000000000b1', 'spotlight', 49, 39.67, 'paid', 'cs_pack', '00000000-0000-0000-0000-00000000bb01'
  from unnest(array['00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f4']::uuid[]) e;
  assert (select count(*) from public.event_feature_purchases where bundle_id = '00000000-0000-0000-0000-00000000bb01') = 3,
    'a pack writes three rows on one session';
  begin
    insert into public.event_feature_purchases (event_id, organiser_id, package, base_aud, amount_aud, stripe_session_id)
    values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b1', 'spotlight', 49, 39.67, 'cs_pack');
    raise exception 'one session must not cover the same event twice';
  exception when unique_violation then null;
  end;
  begin
    insert into public.event_feature_purchases (event_id, organiser_id, package, base_aud, amount_aud, status)
    values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000b1', 'full', 149, 149, 'paid');
    raise exception 'a pack event must not be paid for twice';
  exception when unique_violation then null;
  end;
end $$;
\echo 'event_feature_bundles: all checks passed'
