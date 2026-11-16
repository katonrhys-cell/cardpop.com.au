-- Behavioural checks for 20261116005126_membership_two_yearly_plans.sql.
-- Run by tests/db/run-membership-plans-migration.sh.
\set ON_ERROR_STOP on

-- ── 1. Tiers folded, CHECK narrowed ─────────────────────────────────────────
do $$ begin
  assert (select subscription_tier from public.profiles where display_name = 'Was Premium') = 'pro', 'premium → pro';
  assert (select subscription_tier from public.profiles where display_name = 'Was Elite') = 'ultimate', 'elite → ultimate';
  begin
    update public.profiles set subscription_tier = 'premium' where display_name = 'Hobby';
    raise exception 'the retired premium tier must be refused';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set subscription_tier = 'elite' where display_name = 'Hobby';
    raise exception 'the retired elite tier must be refused';
  exception when check_violation then null;
  end;
end $$;

-- ── 2. Listing quota: Hobby 5, Pro 30, Ultimate unlimited ───────────────────
do $$
declare
  hobby uuid := '00000000-0000-0000-0000-0000000000b1';
  pro   uuid := '00000000-0000-0000-0000-0000000000b5';
  ult   uuid := '00000000-0000-0000-0000-0000000000b4';
begin
  insert into public.listings (seller_id) select hobby from generate_series(1, 5);
  begin
    insert into public.listings (seller_id) values (hobby);
    raise exception 'Hobby must stop at 5 listings a month';
  exception when sqlstate 'P0001' then
    assert sqlerrm like 'LISTING_QUOTA_EXCEEDED%', sqlerrm;
  end;

  insert into public.listings (seller_id) select pro from generate_series(1, 30);
  begin
    insert into public.listings (seller_id) values (pro);
    raise exception 'Pro must stop at 30 listings a month';
  exception when sqlstate 'P0001' then
    assert sqlerrm like 'LISTING_QUOTA_EXCEEDED%', sqlerrm;
  end;

  insert into public.listings (seller_id) select ult from generate_series(1, 60);
end $$;

-- ── 4. Calendar Spotlight ───────────────────────────────────────────────────
do $$ begin
  assert (select is_featured and membership_featured from public.events where title = 'Ultimate show'),
    'backfill: an Ultimate organiser''s event is spotlighted';
  assert (select not is_featured and not membership_featured from public.events where title = 'Admin-entered show'),
    'an admin''s complimentary Ultimate never spotlights the events they enter';
end $$;

-- A paid featuring and an admin pin, both on events of a member who is about
-- to join Ultimate ('Was Elite' is already Ultimate; use the Pro member).
insert into public.events (id, organiser_id, title, status, start_date, is_featured) values
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000b5', 'Plain show',  'approved', '2027-04-01', false),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000b5', 'Pinned show', 'approved', '2027-04-02', true),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000b5', 'Paid show',   'approved', '2027-04-03', true);
insert into public.event_feature_purchases (event_id, organiser_id, package, base_aud, amount_aud, status, stripe_session_id)
values ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000b5', 'spotlight', 49, 49, 'paid', 'cs_paid');

do $$ begin
  assert (select not is_featured from public.events where title = 'Plain show'), 'Pro does not spotlight events';
end $$;

-- Pro → Ultimate (the webhook, service role): the plain show lights up.
update public.profiles set subscription_tier = 'ultimate' where display_name = 'Pro';
do $$ begin
  assert (select is_featured and membership_featured from public.events where title = 'Plain show'), 'joining Ultimate spotlights existing events';
  assert (select is_featured and not membership_featured from public.events where title = 'Pinned show'), 'an already-featured event is not claimed by the membership';
  assert (select is_featured and not membership_featured from public.events where title = 'Paid show'), 'a paid featuring is not claimed by the membership';
end $$;

-- The organiser (browser) adds a new event: featured from the start, and they
-- cannot clear the bookkeeping flag to keep the placement after leaving.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', false);
insert into public.events (id, organiser_id, title, status, start_date, is_featured, membership_featured) values
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000b5', 'New show', 'pending_review', '2027-05-01', false, false);
update public.events set membership_featured = false, title = 'New show (edited)' where id = '00000000-0000-0000-0000-0000000000e6';
reset role;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select is_featured and membership_featured from public.events where id = '00000000-0000-0000-0000-0000000000e6'),
    'an Ultimate organiser''s new event is spotlighted and the flag is pinned';
end $$;

-- A Hobby member cannot feature themselves by writing the flag.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
insert into public.events (id, organiser_id, title, status, start_date, is_featured, membership_featured) values
  ('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000b1', 'Hobby show', 'pending_review', '2027-05-02', true, true);
reset role;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select not is_featured and not membership_featured from public.events where id = '00000000-0000-0000-0000-0000000000e7'),
    'a Hobby member''s event is never spotlighted';
end $$;

-- The membership ends (webhook drops the tier): only what it switched on goes.
update public.profiles set subscription_tier = 'free', subscription_status = 'canceled' where display_name = 'Pro';
do $$ begin
  assert (select not is_featured and not membership_featured from public.events where title = 'Plain show'), 'spotlight ends with the membership';
  assert (select not is_featured and not membership_featured from public.events where id = '00000000-0000-0000-0000-0000000000e6'), 'spotlight ends with the membership (new event)';
  assert (select is_featured from public.events where title = 'Pinned show'), 'an admin pin survives the membership ending';
  assert (select is_featured from public.events where title = 'Paid show'), 'a paid featuring survives the membership ending';
end $$;

-- An admin hands an event they entered to an Ultimate organiser, and back.
update public.events set organiser_id = '00000000-0000-0000-0000-0000000000b4' where title = 'Admin-entered show';
do $$ begin
  assert (select is_featured and membership_featured from public.events where title = 'Admin-entered show'), 'linking an event to an Ultimate organiser spotlights it';
end $$;
update public.events set organiser_id = '00000000-0000-0000-0000-0000000000b1' where title = 'Admin-entered show';
do $$ begin
  assert (select not is_featured and not membership_featured from public.events where title = 'Admin-entered show'), 'the spotlight stays behind when the event changes hands';
end $$;

-- Promoting an Ultimate member to admin ends the membership spotlight.
update public.profiles set is_admin = true where display_name = 'Ultimate';
do $$ begin
  assert (select not is_featured from public.events where title = 'Ultimate show'), 'admins'' events are not membership-spotlighted';
end $$;

-- ── 3. Whatnot shows: Pro and Ultimate, not Hobby ───────────────────────────
update public.profiles set subscription_tier = 'pro', subscription_status = 'active' where display_name = 'Pro';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', false);
insert into public.whatnot_shows (user_id, title) values ('00000000-0000-0000-0000-0000000000b5', 'Pro show');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', false);
insert into public.whatnot_shows (user_id, title) values ('00000000-0000-0000-0000-0000000000b3', 'Ultimate show');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
do $$ begin
  begin
    insert into public.whatnot_shows (user_id, title) values ('00000000-0000-0000-0000-0000000000b1', 'Hobby show');
    raise exception 'a Hobby member must not list Whatnot shows';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\echo membership plans migration: all checks passed
