-- Behavioural checks for 20261023032430_admins_hold_complimentary_ultimate.sql.
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_plan(uid uuid, want_tier text, want_status text, label text) returns void
language plpgsql as $$
declare t text; s text;
begin
  select subscription_tier, subscription_status into t, s from public.profiles where id = uid;
  if t is distinct from want_tier or s is distinct from want_status then
    raise exception '%: expected %/% but got %/%', label, want_tier, want_status, t, s;
  end if;
end $$;

begin;
-- Backfill: every existing admin is on complimentary Ultimate…
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000a', 'ultimate', 'grandfathered', 'backfill: hobby admin');
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000d', 'ultimate', 'grandfathered', 'backfill: paying admin');
-- …with the Stripe subscription id left in place so it can be found and cancelled.
do $$ begin
  if (select stripe_subscription_id from public.profiles where id = '00000000-0000-0000-0000-00000000000d') <> 'sub_admin' then
    raise exception 'backfill must not discard the stripe_subscription_id';
  end if;
end $$;
-- …and nobody else was touched.
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000b', 'free', 'none', 'backfill: hobby user');
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000e', 'pro', 'trialing', 'backfill: paying user');

-- Promotion grants the plan (the admin role route writes exactly this).
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000b', 'ultimate', 'grandfathered', 'promote: hobby user');
do $$ begin
  if (select trial_ends_at from public.profiles where id = '00000000-0000-0000-0000-00000000000b') is not null then
    raise exception 'promote must clear trial_ends_at';
  end if;
end $$;

-- Demotion revokes the complimentary plan: back to Hobby.
update public.profiles set is_admin = false where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000b', 'free', 'none', 'demote: complimentary admin');

-- A paying member promoted then demoted: the grant replaces the paid plan while
-- they are an admin (Stripe is cancelled server-side), and demotion returns
-- them to Hobby rather than resurrecting a plan nobody is billing for.
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000e', 'ultimate', 'grandfathered', 'promote: paying user');
update public.profiles set is_admin = false where id = '00000000-0000-0000-0000-00000000000e';
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000e', 'free', 'none', 'demote: formerly paying admin');

-- A demotion never touches a REAL paid subscription (status not grandfathered):
-- if something external set an admin back onto a billed plan, demoting them
-- leaves that plan alone.
update public.profiles set subscription_tier = 'elite', subscription_status = 'active' where id = '00000000-0000-0000-0000-00000000000d';
update public.profiles set is_admin = false where id = '00000000-0000-0000-0000-00000000000d';
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000d', 'elite', 'active', 'demote: billed admin keeps paid plan');

-- Writing is_admin = true to an admin whose plan drifted re-asserts the grant.
update public.profiles set subscription_tier = 'pro', subscription_status = 'none' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000a', 'ultimate', 'grandfathered', 're-assert: drifted admin');

-- Unrelated profile writes do not fire the trigger (scoped to is_admin): a
-- non-admin's own plan columns written by the service role stay as written.
update public.profiles set subscription_tier = 'premium', subscription_status = 'active', bio = 'hi' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000b', 'premium', 'active', 'unrelated write: untouched');

-- A brand-new profile row inserted as admin is born on the complimentary plan.
insert into public.profiles (id, username, display_name, is_admin) values ('00000000-0000-0000-0000-00000000000f', 'newadmin', 'New Admin', true);
select pg_temp.expect_plan('00000000-0000-0000-0000-00000000000f', 'ultimate', 'grandfathered', 'insert: new admin');
insert into public.profiles (id, username, display_name, is_admin) values ('00000000-0000-0000-0000-000000000010', 'newuser', 'New User', false);
select pg_temp.expect_plan('00000000-0000-0000-0000-000000000010', null, null, 'insert: new user untouched');

-- The function is not callable by anon.
do $$ begin
  if has_function_privilege('anon', 'public.sync_admin_complimentary_membership()', 'execute') then
    raise exception 'anon can execute sync_admin_complimentary_membership()';
  end if;
end $$;
rollback;

\echo admin_membership: all checks passed
