-- Extra stand-ins the shop-ownership migration needs on top of
-- store_pages_stub_schema.sql + the store-pages migration: auth.users, the
-- notification_type enum and a minimal storage.objects. Used by
-- tests/db/run-store-owner-requests-migration.sh only.
create table if not exists auth.users (id uuid primary key);
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c')
on conflict do nothing;
insert into public.profiles (id, is_admin) values ('00000000-0000-0000-0000-00000000000c', false) on conflict do nothing;

do $$ begin create type public.notification_type as enum ('system'); exception when duplicate_object then null; end $$;

create schema if not exists storage;
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create or replace function storage.foldername(name text) returns text[] language sql immutable as
$$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant insert, select on storage.objects to authenticated;
