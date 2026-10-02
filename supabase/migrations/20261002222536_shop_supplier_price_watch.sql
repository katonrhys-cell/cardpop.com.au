-- Supplier link + weekly price watch for shop products. Admin-only.
--
-- Where CardPop buys a product from (a Temu listing, a wholesaler's page) is
-- commercially sensitive like the wholesale cost, so it lives on
-- shop_product_costs (RLS: admins only, no public policy) — never on
-- shop_products, whose rows are publicly readable.
--
--   supplier_url               the page the product is ordered from
--   supplier_price_aud         the last price read from that page
--   supplier_price_currency    currency the page quoted it in (AUD expected)
--   supplier_price_status      ok | changed | unreadable | error
--   supplier_price_error       why the last check couldn't read a price
--   supplier_price_checked_at  when the page was last checked
--   supplier_price_changed_at  when the price last moved
--
-- A daily GitHub Actions job (.github/workflows/cron-supplier-price-watch.yml →
-- GET /api/shop-supplier-watch/run) re-checks every product whose last check
-- is 7+ days old, appends to shop_supplier_price_history, and bells every
-- admin when a price changes. Runbook: docs/supplier-price-watch.md.
--
-- Also seeds the Temu link for the Magnetic Metal Slab Case colours.
--
-- Idempotent: add column / create table if not exists, policies dropped and
-- re-created by name, seed only fills a blank link.

-- product_id-only rows (link but no cost yet) are allowed: cost stays null.
alter table public.shop_product_costs add column if not exists supplier_url text;
alter table public.shop_product_costs add column if not exists supplier_price_aud numeric(10,2);
alter table public.shop_product_costs add column if not exists supplier_price_currency text;
alter table public.shop_product_costs add column if not exists supplier_price_status text;
alter table public.shop_product_costs add column if not exists supplier_price_error text;
alter table public.shop_product_costs add column if not exists supplier_price_checked_at timestamptz;
alter table public.shop_product_costs add column if not exists supplier_price_changed_at timestamptz;

alter table public.shop_product_costs drop constraint if exists shop_product_costs_supplier_url_http;
alter table public.shop_product_costs add constraint shop_product_costs_supplier_url_http
  check (supplier_url is null or (supplier_url ~* '^https?://' and char_length(supplier_url) <= 2048));

alter table public.shop_product_costs drop constraint if exists shop_product_costs_supplier_price_status_check;
alter table public.shop_product_costs add constraint shop_product_costs_supplier_price_status_check
  check (supplier_price_status is null or supplier_price_status in ('ok', 'changed', 'unreadable', 'error'));

comment on column public.shop_product_costs.supplier_url is
  'Admin-only: the supplier page this product is ordered from. Watched weekly for price changes.';

create index if not exists idx_shop_product_costs_supplier_due
  on public.shop_product_costs (supplier_price_checked_at nulls first)
  where supplier_url is not null;

-- Every check, so a price's history can be read back.
create table if not exists public.shop_supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products(id) on delete cascade,
  checked_at timestamptz not null default now(),
  supplier_url text not null,
  price_aud numeric(10,2),
  currency text,
  status text not null check (status in ('ok', 'changed', 'unreadable', 'error')),
  error text,
  source text
);

create index if not exists idx_shop_supplier_price_history_product
  on public.shop_supplier_price_history (product_id, checked_at desc);

comment on table public.shop_supplier_price_history is
  'Admin-only log of every supplier price check. Never expose through a public policy or view.';

alter table public.shop_supplier_price_history enable row level security;

drop policy if exists "shop_supplier_price_history_admin_read" on public.shop_supplier_price_history;
create policy "shop_supplier_price_history_admin_read"
  on public.shop_supplier_price_history for select
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

-- ── Seed: Magnetic Metal Slab Case → its Temu listing ───────────────────────
insert into public.shop_product_costs (product_id, supplier, supplier_url, source)
select p.id, 'Temu',
       'https://www.temu.com/au/resistant-magnetic-metal-slab-35pt-for-psa-bgs-cgc--high--glass--magnetic-lock-durable-metal-frame-stackable-design-orange-g-601105058555908.html',
       'Temu listing'
from public.shop_products p
where p.family_sku = 'CP-METAL-SLAB-PSA35'
on conflict (product_id) do update
  set supplier_url = excluded.supplier_url,
      supplier = coalesce(public.shop_product_costs.supplier, excluded.supplier)
  where public.shop_product_costs.supplier_url is null;
