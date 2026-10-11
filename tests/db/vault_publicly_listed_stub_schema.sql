-- Minimal stand-in for the parts of the Supabase schema the publicly_listed
-- migration touches. Used by tests/db/run-vault-publicly-listed-migration.sh only.
create extension if not exists "uuid-ossp";
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create type listing_status as enum ('draft', 'active', 'sold', 'ended', 'archived', 'removed');

create table public.profiles (id uuid primary key, is_admin boolean default false);

create table public.vault_items (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id),
  card_name text,
  is_public boolean not null default false,
  is_featured boolean not null default false,
  locked boolean not null default false,
  estimated_value_aud numeric,
  updated_at timestamptz not null default now()
);

create table public.vault_images (
  id uuid primary key default uuid_generate_v4(),
  vault_item_id uuid references public.vault_items(id) on delete cascade,
  storage_path text
);

create table public.listings (
  id uuid primary key default uuid_generate_v4(),
  vault_item_id uuid references public.vault_items(id) on delete cascade,
  seller_id uuid references public.profiles(id),
  status listing_status not null default 'active',
  price_aud numeric
);

-- The production lock trigger this migration rewrites (20260823060200), so the
-- test proves the rewrite keeps its guarantees.
create or replace function public.trg_fn_vault_enforce_item_lock()
returns trigger language plpgsql security definer set search_path = public as $$
DECLARE v_is_admin BOOLEAN := FALSE;
BEGIN
  IF OLD.locked THEN
    SELECT COALESCE(is_admin, FALSE) INTO v_is_admin FROM profiles WHERE id = auth.uid();
    IF NOT v_is_admin THEN
      IF NEW.locked THEN
        RAISE EXCEPTION 'This card is locked. Unlock it before making changes.';
      ELSIF (to_jsonb(NEW) - 'locked' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'locked' - 'updated_at') THEN
        RAISE EXCEPTION 'This card is locked. Unlock it before making changes.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
create trigger trg_vault_enforce_item_lock before update on public.vault_items
  for each row execute function public.trg_fn_vault_enforce_item_lock();

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger vault_items_updated_at before update on public.vault_items
  for each row execute function public.set_updated_at();

-- The policies the migration replaces, as they stand in production.
alter table public.vault_items enable row level security;
alter table public.vault_images enable row level security;
create policy "vault_items_select_access" on public.vault_items as permissive for select to public
  using (
    (exists (select 1 from listings where listings.vault_item_id = vault_items.id
               and listings.status in ('active'::listing_status, 'sold'::listing_status)))
    or ((select auth.uid()) = owner_id)
  );
create policy "vault_items_public_featured_select" on public.vault_items as permissive for select to public
  using (is_featured = true);
create policy "vault_images_public_listing_select" on public.vault_images as permissive for select to public
  using (exists (select 1 from listings where listings.vault_item_id = vault_images.vault_item_id
                   and listings.status in ('active'::listing_status, 'sold'::listing_status)));
create policy "vault_images_public_featured_select" on public.vault_images as permissive for select to public
  using (exists (select 1 from public.vault_items vi where vi.id = vault_images.vault_item_id and vi.is_featured = true));
create policy "Users can manage images for their own vault items" on public.vault_images as permissive for all to public
  using (exists (select 1 from vault_items where vault_items.id = vault_images.vault_item_id and vault_items.owner_id = (select auth.uid())));

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
