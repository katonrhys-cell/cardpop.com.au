-- Behavioural checks for 20261105070414_efficiency_housekeeping.sql, run after
-- tests/db/vault_publicly_listed.test.sql has seeded and checked visibility.
\set ON_ERROR_STOP on

-- ── vault_images: one SELECT policy, no FOR ALL, owner writes still work ────
do $$
declare n int;
begin
  select count(*) into n from pg_policies where tablename = 'vault_images' and cmd = 'ALL';
  assert n = 0, 'no FOR ALL policy left on vault_images: ' || n;
  select count(*) into n from pg_policies where tablename = 'vault_images' and cmd = 'SELECT';
  assert n = 1, 'exactly one vault_images SELECT policy: ' || n;
  select count(*) into n from pg_policies where tablename = 'vault_images' and cmd in ('INSERT', 'UPDATE', 'DELETE');
  assert n = 3, 'one owner policy per write command: ' || n;
end $$;

-- The seller (owner of every seeded card) can add, change and remove images.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
set local role authenticated;
do $$
declare card uuid; img uuid; n int;
begin
  select id into card from public.vault_items where card_name = 'Private';
  insert into public.vault_images (vault_item_id, storage_path) values (card, 'owner-new') returning id into img;
  update public.vault_images set storage_path = 'owner-renamed' where id = img;
  get diagnostics n = row_count; assert n = 1, 'owner updates own image';
  delete from public.vault_images where id = img;
  get diagnostics n = row_count; assert n = 1, 'owner deletes own image';
  select count(*) into n from public.vault_images where vault_item_id = card;
  assert n = 1, 'owner still sees the private card''s original image: ' || n;
end $$;
rollback;

-- Another member can neither add nor touch images on the seller's cards.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
set local role authenticated;
do $$
declare card uuid; n int;
begin
  select vault_item_id into card from public.vault_images where storage_path = 'a';
  begin
    insert into public.vault_images (vault_item_id, storage_path) values (card, 'intruder');
    raise exception 'other member insert should have been refused';
  exception when insufficient_privilege then null;
  end;
  update public.vault_images set storage_path = 'hijack' where storage_path = 'a';
  get diagnostics n = row_count; assert n = 0, 'other member cannot update a listed card''s image';
  delete from public.vault_images where storage_path = 'a';
  get diagnostics n = row_count; assert n = 0, 'other member cannot delete a listed card''s image';
  select count(*) into n from public.vault_images where storage_path = 'a';
  assert n = 1, 'other member still sees the listed card''s image';
end $$;
rollback;

-- Anonymous visitors can't write at all.
begin;
set local role anon;
do $$
declare card uuid;
begin
  select vault_item_id into card from public.vault_images where storage_path = 'a';
  begin
    insert into public.vault_images (vault_item_id, storage_path) values (card, 'anon');
    raise exception 'anon insert should have been refused';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

-- ── Housekeeping: stale rate-limit keys go, live ones stay ──────────────────
insert into public.rate_limit_counters (key, hits, window_start) values
  ('stale', 5, now() - interval '3 days'),
  ('live', 2, now() - interval '10 minutes');
select private.run_housekeeping();
do $$
declare n int;
begin
  select count(*) into n from public.rate_limit_counters where key = 'stale';
  assert n = 0, 'stale rate-limit key removed';
  select count(*) into n from public.rate_limit_counters where key = 'live';
  assert n = 1, 'live rate-limit key kept';
end $$;

-- Not callable through the API.
do $$
begin
  assert not has_function_privilege('anon', 'private.run_housekeeping()', 'execute'), 'anon cannot run housekeeping';
  assert not has_function_privilege('authenticated', 'private.run_housekeeping()', 'execute'), 'members cannot run housekeeping';
end $$;

-- ── Indexes ──────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from pg_indexes where indexname in (
    'card_price_snapshots_snapshot_date_idx', 'offers_open_expires_at_idx',
    'giveaways_created_by_idx', 'giveaways_drawn_by_idx', 'giveaways_winner_entry_id_idx',
    'giveaway_entries_user_id_idx', 'giveaway_entries_verified_by_idx');
  assert n = 7, 'indexes created on the tables that exist: ' || n;
  select count(*) into n from pg_indexes where indexname = 'offers_open_expires_at_idx'
     and indexdef like '%WHERE%pending%countered%';
  assert n = 1, 'offers expiry index is partial on live statuses';
  -- Tables this stub doesn't have were skipped rather than failing the push.
  select count(*) into n from pg_indexes where indexname = 'shop_restock_requests_user_id_idx';
  assert n = 0, 'missing table skipped';
end $$;

select 'efficiency_housekeeping: ok' as result;
