-- Trading card supplies dropshipping range.
--
-- Adds: suppliers, per-product sourcing data (kept in a separate admin-only
-- table so cost prices and supplier details are never readable through the
-- public shop_products policies), public supply/stock flags on shop_products,
-- and supply_fulfilments — the dropship fulfilment queue keyed off orders.
--
-- Pricing settings (default markup %, free-shipping threshold, flat shipping
-- fee, business ABN) live in platform_settings via the backend's
-- getPlatformSetting/setPlatformSetting helpers with code-level defaults, so
-- no seed rows are required here.

-- ─── Suppliers ────────────────────────────────────────────────────────────────

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  phone text,
  website_url text,
  portal_url text,
  ordering_method text not null default 'email' check (ordering_method in ('email', 'portal')),
  ordering_instructions text,
  supports_blind_shipping boolean not null default false,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_admin_select" on public.suppliers;
create policy "suppliers_admin_select"
  on public.suppliers for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "suppliers_admin_insert" on public.suppliers;
create policy "suppliers_admin_insert"
  on public.suppliers for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "suppliers_admin_update" on public.suppliers;
create policy "suppliers_admin_update"
  on public.suppliers for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "suppliers_admin_delete" on public.suppliers;
create policy "suppliers_admin_delete"
  on public.suppliers for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- ─── Public supply flags on shop_products ─────────────────────────────────────
-- Safe to expose through the existing public read policy.

alter table public.shop_products add column if not exists is_supply boolean not null default false;
alter table public.shop_products add column if not exists in_stock boolean not null default true;
alter table public.shop_products add column if not exists featured boolean not null default false;

create index if not exists idx_shop_products_is_supply on public.shop_products(is_supply) where is_supply = true;

-- ─── Sourcing data (admin-only; margins must never be public) ─────────────────

create table if not exists public.shop_product_sourcing (
  product_id uuid primary key references public.shop_products(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_sku text,
  cost_price_aud numeric(10,2) check (cost_price_aud is null or cost_price_aud >= 0),
  markup_pct numeric(6,2) check (markup_pct is null or markup_pct >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shop_product_sourcing_supplier on public.shop_product_sourcing(supplier_id);

alter table public.shop_product_sourcing enable row level security;

drop policy if exists "shop_product_sourcing_admin_select" on public.shop_product_sourcing;
create policy "shop_product_sourcing_admin_select"
  on public.shop_product_sourcing for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "shop_product_sourcing_admin_insert" on public.shop_product_sourcing;
create policy "shop_product_sourcing_admin_insert"
  on public.shop_product_sourcing for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "shop_product_sourcing_admin_update" on public.shop_product_sourcing;
create policy "shop_product_sourcing_admin_update"
  on public.shop_product_sourcing for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "shop_product_sourcing_admin_delete" on public.shop_product_sourcing;
create policy "shop_product_sourcing_admin_delete"
  on public.shop_product_sourcing for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- ─── Dropship fulfilment queue ────────────────────────────────────────────────
-- One row per (order × supplier). Created by the Stripe webhook (service role)
-- when a paid order contains supply items; driven through its lifecycle by the
-- admin fulfilment routes. Customers may read their own rows for order status.

create table if not exists public.supply_fulfilments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid references public.profiles(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'awaiting_fulfilment'
    check (status in ('awaiting_fulfilment', 'ordered_with_supplier', 'shipped', 'complete', 'cancelled', 'refunded')),
  -- Snapshot of the supply lines this fulfilment covers:
  -- [{ product_id, title, supplier_sku, quantity, unit_price_aud, cost_price_aud }]
  items jsonb not null default '[]'::jsonb,
  shipping_name text,
  shipping_address text,
  shipping_suburb text,
  shipping_state text,
  shipping_postcode text,
  supplier_order_ref text,
  tracking_number text,
  tracking_carrier text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  shipped_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supply_fulfilments_status on public.supply_fulfilments(status);
create index if not exists idx_supply_fulfilments_order on public.supply_fulfilments(order_id);
create index if not exists idx_supply_fulfilments_buyer on public.supply_fulfilments(buyer_id);

alter table public.supply_fulfilments enable row level security;

drop policy if exists "supply_fulfilments_buyer_select" on public.supply_fulfilments;
create policy "supply_fulfilments_buyer_select"
  on public.supply_fulfilments for select
  using (buyer_id = auth.uid());

drop policy if exists "supply_fulfilments_admin_select" on public.supply_fulfilments;
create policy "supply_fulfilments_admin_select"
  on public.supply_fulfilments for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- No insert/update/delete policies: all writes go through the backend service
-- role (Stripe webhook and admin fulfilment routes), which bypasses RLS.
