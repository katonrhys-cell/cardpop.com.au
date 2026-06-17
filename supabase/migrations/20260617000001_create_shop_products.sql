-- Admin-managed shop product catalogue (platform-owned, distinct from the
-- user marketplace `listings`). Applied to production 2026-06-17.

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price_aud numeric(10,2) not null check (price_aud >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  product_type text,
  category text,
  image_url text,
  images jsonb not null default '[]'::jsonb,
  slug text,
  status text not null default 'active' check (status in ('active','draft','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shop_products_status on public.shop_products(status);
create index if not exists idx_shop_products_created_at on public.shop_products(created_at desc);

alter table public.shop_products enable row level security;

create policy "shop_products_public_read_active"
  on public.shop_products for select
  using (status = 'active');

create policy "shop_products_admin_read_all"
  on public.shop_products for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create policy "shop_products_admin_insert"
  on public.shop_products for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create policy "shop_products_admin_update"
  on public.shop_products for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create policy "shop_products_admin_delete"
  on public.shop_products for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
