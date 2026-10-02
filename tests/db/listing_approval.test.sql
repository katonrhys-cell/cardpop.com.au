-- Behavioural checks for enforce_listing_approval on INSERT and UPDATE.
\set ON_ERROR_STOP on
insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', false),
  ('00000000-0000-0000-0000-0000000000ad', true);
insert into public.platform_settings values ('listing_approval_required', 'true'::jsonb);

do $$
declare
  seller constant uuid := '00000000-0000-0000-0000-00000000000a';
  admin  constant uuid := '00000000-0000-0000-0000-0000000000ad';
  lid uuid;
  s listing_status;
begin
  -- Seller insert is held for approval (unchanged behaviour).
  perform set_config('request.jwt.claim.sub', seller::text, true);
  insert into public.listings (seller_id, status) values (seller, 'active') returning id, status into lid, s;
  assert s = 'pending', 'insert should be held: ' || s;

  -- Seller cannot promote their own pending listing.
  update public.listings set status = 'active' where id = lid returning status into s;
  assert s = 'pending', 'seller pending->active must stay pending: ' || s;

  -- An unrelated edit that rewrites status=pending is fine.
  update public.listings set status = 'pending', price_aud = 5 where id = lid returning status into s;
  assert s = 'pending', 'pending stays pending';

  -- Seller re-listing an archived row is also held.
  update public.listings set status = 'archived' where id = lid;
  update public.listings set status = 'active' where id = lid returning status into s;
  assert s = 'pending', 'archived->active must be held: ' || s;

  -- Admin approval publishes.
  perform set_config('request.jwt.claim.sub', admin::text, true);
  update public.listings set status = 'active' where id = lid returning status into s;
  assert s = 'active', 'admin approval should publish: ' || s;

  -- Seller editing a live listing keeps it live.
  perform set_config('request.jwt.claim.sub', seller::text, true);
  update public.listings set status = 'active', price_aud = 9 where id = lid returning status into s;
  assert s = 'active', 'active->active edit stays live: ' || s;

  -- Service role (no auth.uid()) can mark sold and restore active.
  perform set_config('request.jwt.claim.sub', '', true);
  update public.listings set status = 'sold' where id = lid returning status into s;
  assert s = 'sold';
  update public.listings set status = 'active' where id = lid returning status into s;
  assert s = 'active', 'service role is trusted: ' || s;

  -- Setting off: seller pending->active goes live.
  update public.platform_settings set value = 'false'::jsonb where key = 'listing_approval_required';
  update public.listings set status = 'pending' where id = lid;
  perform set_config('request.jwt.claim.sub', seller::text, true);
  update public.listings set status = 'active' where id = lid returning status into s;
  assert s = 'active', 'no approval required -> active: ' || s;

  raise notice 'listing_approval tests passed';
end $$;
