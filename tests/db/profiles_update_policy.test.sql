-- Behavioural checks for profiles_update_access after
-- 20261002081506_fix_profiles_update_policy_column_grants.sql.
-- Each block runs as the API role with a given auth.uid() and raises on failure.
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_ok(uid uuid, stmt text, want int) returns void
language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  execute stmt;
  get diagnostics n = row_count;
  reset role;
  if n <> want then raise exception 'expected % row(s), got %: %', want, n, stmt; end if;
end $$;

create or replace function pg_temp.expect_denied(uid uuid, stmt text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  begin
    execute stmt;
  exception when insufficient_privilege then
    reset role;
    if sqlerrm not like 'new row violates row-level security policy%' then
      raise exception 'denied for the wrong reason (%): %', sqlerrm, stmt;
    end if;
    return;
  end;
  reset role;
  raise exception 'expected RLS denial, but it succeeded: %', stmt;
end $$;

begin;
-- A user saving their public profile — the bug: this raised
-- "permission denied for table profiles".
select pg_temp.expect_ok('00000000-0000-0000-0000-00000000000b',
  $$update public.profiles set display_name = 'New', bio = 'b', personal_collection = 'pc',
      location_state = 'Victoria', location_suburb = 'Ascot Vale', avatar_url = null,
      social_links = '{"twitter":""}' where id = auth.uid()$$, 1);
-- Same for an admin editing their own profile.
select pg_temp.expect_ok('00000000-0000-0000-0000-00000000000a',
  $$update public.profiles set bio = 'admin bio' where id = auth.uid()$$, 1);
-- A user can't touch someone else's row.
select pg_temp.expect_ok('00000000-0000-0000-0000-00000000000b',
  $$update public.profiles set bio = 'x' where id = '00000000-0000-0000-0000-00000000000c'$$, 0);
-- Pinned columns stay pinned for non-admins.
select pg_temp.expect_denied('00000000-0000-0000-0000-00000000000b',
  $$update public.profiles set wallet_balance_aud = 99999 where id = auth.uid()$$);
select pg_temp.expect_denied('00000000-0000-0000-0000-00000000000b',
  $$update public.profiles set is_admin = true where id = auth.uid()$$);
select pg_temp.expect_denied('00000000-0000-0000-0000-00000000000b',
  $$update public.profiles set email = 'attacker@example.com' where id = auth.uid()$$);
select pg_temp.expect_denied('00000000-0000-0000-0000-00000000000b',
  $$update public.profiles set legal_name = 'Someone Else' where id = auth.uid()$$);
select pg_temp.expect_denied('00000000-0000-0000-0000-00000000000b',
  $$update public.profiles set subscription_tier = 'ultimate' where id = auth.uid()$$);
-- Sensitive columns are still unreadable from the client.
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  begin
    perform wallet_balance_aud from public.profiles;
    raise exception 'wallet_balance_aud became client-readable';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;
-- The helper is not callable by anon.
do $$ begin
  if has_function_privilege('anon', 'private.current_profile()', 'execute') then
    raise exception 'anon can execute private.current_profile()';
  end if;
end $$;
rollback;

\echo profiles_update_policy: all checks passed
