-- After the migration: nobody but the owner can read an ABN, nobody can read
-- a business email/phone, the public columns still read, and the browser can
-- no longer write business_profiles (so no self-approval).
\set ON_ERROR_STOP 1
create or replace function pg_temp.expect_denied(sql text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL: % was allowed', what;
exception when insufficient_privilege then
  raise notice 'ok: % denied', what;
end $$;

-- Anonymous visitor
set role anon;
select pg_temp.expect_denied('select abn from public.profiles', 'anon reading profiles.abn');
select pg_temp.expect_denied('select email from public.business_profiles', 'anon reading business email');
select pg_temp.expect_denied('select phone from public.business_profiles', 'anon reading business phone');
select pg_temp.expect_denied('select abn from public.business_profiles', 'anon reading business ABN');
select pg_temp.expect_denied('select rejection_reason from public.business_profiles', 'anon reading review notes');
do $$ begin
  if (select count(*) from public.business_profiles where business_name = 'Seller Cards' and store_suburb = 'Fitzroy') <> 1 then
    raise exception 'FAIL: public storefront columns no longer readable';
  end if;
  if (select display_name from public.profiles limit 1) <> 'Seller' then
    raise exception 'FAIL: public profile columns no longer readable';
  end if;
  raise notice 'ok: public columns still readable';
end $$;
select pg_temp.expect_denied('select public.get_my_abn()', 'anon calling get_my_abn');
reset role;

-- Another signed-in member
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect_denied('select abn from public.profiles', 'another member reading profiles.abn');
do $$ begin
  if public.get_my_abn() is not null then raise exception 'FAIL: get_my_abn leaked someone else''s ABN'; end if;
  raise notice 'ok: get_my_abn returns nothing for a member without an ABN';
end $$;
select pg_temp.expect_denied(
  $q$insert into public.business_profiles (user_id, business_name, storefront_status) values ('22222222-2222-2222-2222-222222222222', 'Self Approved', 'approved')$q$,
  'a member inserting an approved storefront');
reset role;

-- The owner
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if public.get_my_abn() <> '51824753556' then raise exception 'FAIL: owner cannot read their own ABN'; end if;
  raise notice 'ok: owner reads their own ABN through get_my_abn()';
end $$;
update public.profiles set abn = '53004085616' where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect_denied(
  $q$update public.business_profiles set storefront_status = 'approved', business_name = 'x'$q$,
  'the owner editing business_profiles from the browser');
reset role;
do $$ begin
  if (select abn from public.profiles where id = '11111111-1111-1111-1111-111111111111') <> '53004085616' then
    raise exception 'FAIL: owner could not update their ABN';
  end if;
  raise notice 'ok: owner can still update their ABN';
end $$;
