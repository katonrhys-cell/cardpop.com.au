-- Checks for 20261116221914_store_owner_requests.sql.
-- a = admin, b = the shop's owner, c = another member.
\set ON_ERROR_STOP 1
update public.local_game_stores set owner_id = '00000000-0000-0000-0000-00000000000b' where slug = 'swap-itt-melbourne';

-- The owner edits the public details; the pinned columns stay as they were.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
update public.local_game_stores
   set phone = '03 9000 0000', opening_hours = 'Daily: 10am – 6pm', logo_url = 'https://example.com/logo.webp',
       name = 'Hijacked', slug = 'hijacked', city = 'sydney', state = 'NSW', status = 'rejected',
       owner_id = '00000000-0000-0000-0000-00000000000c'
 where slug = 'swap-itt-melbourne';
reset role;
do $$
declare r record;
begin
  select * into r from public.local_game_stores where slug = 'swap-itt-melbourne';
  assert r.phone = '03 9000 0000' and r.opening_hours = 'Daily: 10am – 6pm' and r.logo_url is not null, 'owner edit should apply';
  assert r.name = 'Swap Itt' and r.city = 'melbourne' and r.state = 'VIC' and r.status = 'approved', 'pinned columns changed';
  assert r.owner_id = '00000000-0000-0000-0000-00000000000b', 'owner changed their own owner_id';
end $$;

-- The owner cannot touch another shop; another member cannot touch theirs.
set role authenticated;
do $$
declare n int;
begin
  update public.local_game_stores set phone = 'x' where slug = 'old-shop-sydney';
  get diagnostics n = row_count;
  assert n = 0, 'owner updated a shop they do not own';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$
declare n int;
begin
  update public.local_game_stores set phone = 'x' where slug = 'swap-itt-melbourne';
  get diagnostics n = row_count;
  assert n = 0, 'a stranger updated the shop';
  -- No browser writes to the requests table.
  begin
    insert into public.store_owner_requests (user_id, store_id)
      select '00000000-0000-0000-0000-00000000000c', id from public.local_game_stores where slug = 'old-shop-sydney';
    raise exception 'member inserted a request directly';
  exception when insufficient_privilege then null;
  end;
  -- Uploads: only into a shop folder they own.
  begin
    insert into storage.objects (bucket_id, name) values ('media', 'stores/swap-itt-melbourne/photos/1-x.webp');
    raise exception 'a stranger uploaded into the shop folder';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into storage.objects (bucket_id, name) values ('media', 'stores/swap-itt-melbourne/photos/1-x.webp');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('media', 'stores/old-shop-sydney/photos/1-x.webp');
    raise exception 'owner uploaded into another shop';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('media', 'event-reviews/gallery/1-x.webp');
    raise exception 'owner uploaded outside stores/';
  exception when insufficient_privilege then null;
  end;
end $$;

-- An admin still changes anything, including the name and the owner.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.local_game_stores set name = 'Swap Itt Melbourne', owner_id = null where slug = 'swap-itt-melbourne';
reset role;
do $$
declare r record;
begin
  select * into r from public.local_game_stores where slug = 'swap-itt-melbourne';
  assert r.name = 'Swap Itt Melbourne' and r.owner_id is null, 'admin edit should apply';
end $$;

-- Service role: one pending request per member per shop; a member reads only their own.
insert into public.store_owner_requests (user_id, store_id)
  select '00000000-0000-0000-0000-00000000000b', id from public.local_game_stores where slug = 'swap-itt-melbourne';
do $$ begin
  begin
    insert into public.store_owner_requests (user_id, store_id)
      select '00000000-0000-0000-0000-00000000000b', id from public.local_game_stores where slug = 'swap-itt-melbourne';
    raise exception 'second pending request accepted';
  exception when unique_violation then null;
  end;
end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ declare n int; begin
  select count(*) into n from public.store_owner_requests;
  assert n = 0, 'a member read someone else''s request';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ declare n int; begin
  select count(*) into n from public.store_owner_requests;
  assert n = 1, 'a member could not read their own request';
end $$;
reset role;
select 'store owner requests migration: ok' as result;
