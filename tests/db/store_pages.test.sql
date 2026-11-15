-- Checks for 20261114212757_store_pages_media.sql.
\set ON_ERROR_STOP 1
do $$
declare n int; r record;
begin
  -- Existing rows get empty galleries; Swap Itt Melbourne is seeded once.
  select jsonb_array_length(photos) + jsonb_array_length(videos) into n
    from public.local_game_stores where slug = 'old-shop-sydney';
  assert n = 0, 'existing store should start with no media';
  select * into r from public.local_game_stores where slug = 'swap-itt-melbourne';
  assert r.status = 'approved' and r.city = 'melbourne', 'Swap Itt Melbourne should be seeded approved';
  assert jsonb_array_length(r.photos) = 4 and jsonb_array_length(r.videos) = 1, 'Swap Itt media';
  select count(*) into n from public.local_game_stores where name = 'Swap Itt';
  assert n = 1, 're-applying the migration must not duplicate the seed';

  -- photos / videos must be arrays.
  begin
    update public.local_game_stores set photos = '{}'::jsonb where slug = 'old-shop-sydney';
    raise exception 'object photos accepted';
  exception when check_violation then null;
  end;
end $$;

-- The public reads the new columns but still not the submitter's email.
set role anon;
select opening_hours, instagram_url, logo_url, photos, videos from public.local_game_stores where slug = 'swap-itt-melbourne';
do $$ begin
  begin
    perform submitter_email from public.local_game_stores;
    raise exception 'anon read submitter_email';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- A member cannot add a store from the browser; an admin can.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin
    insert into public.local_game_stores (slug, name, city, state) values ('sneaky', 'Sneaky', 'perth', 'WA');
    raise exception 'member inserted a store';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.local_game_stores (slug, name, city, state, status, photos)
values ('admin-shop-perth', 'Admin Shop', 'perth', 'WA', 'approved', '[{"url":"https://example.com/a.webp"}]');
update public.local_game_stores set opening_hours = 'Daily: 10am – 5pm' where slug = 'admin-shop-perth';
reset role;
select 'store pages migration: ok' as result;
