-- Minimal stand-ins for the tables the storefront privacy migration touches,
-- with the grants they have in production (profiles: column grants incl.
-- abn; business_profiles: Supabase's default table-wide grants + the owner
-- insert/update policies).
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;

create table public.profiles (
  id uuid primary key,
  display_name text,
  business_name text,
  abn text,
  email text
);
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select using (true);
create policy profiles_own_update on public.profiles for update using (id = auth.uid());
grant select (id, display_name, business_name, abn) on public.profiles to anon, authenticated;
grant update (display_name, business_name, abn) on public.profiles to authenticated;

create type storefront_status as enum ('pending', 'approved', 'rejected');
create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  business_name text,
  abn text,
  business_type text,
  established_year int,
  storefront_status storefront_status default 'pending',
  storefront_slug text,
  tagline text, about text, banner_url text, logo_url text, website_url text,
  instagram_handle text, facebook_url text,
  phone text, email text,
  has_physical_store boolean,
  store_address text, store_suburb text, store_state text, store_postcode text,
  opening_hours jsonb, specialises_in text[],
  total_listings int, total_sales int,
  reviewed_by uuid, reviewed_at timestamptz, rejection_reason text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.business_profiles enable row level security;
grant all on public.business_profiles to anon, authenticated;
create policy business_profiles_select_access on public.business_profiles for select
  using (storefront_status = 'approved' or auth.uid() = user_id);
create policy "Users can create their own business profile" on public.business_profiles for insert
  with check (auth.uid() = user_id);
create policy "Users can update their own business profile" on public.business_profiles for update
  using (auth.uid() = user_id);

insert into public.profiles values
  ('11111111-1111-1111-1111-111111111111', 'Seller', 'Seller Cards', '51824753556', 'seller@example.com');
insert into public.business_profiles (user_id, business_name, abn, phone, email, storefront_status, store_suburb)
  values ('11111111-1111-1111-1111-111111111111', 'Seller Cards', '51824753556', '0400000000', 'shop@example.com', 'approved', 'Fitzroy');
