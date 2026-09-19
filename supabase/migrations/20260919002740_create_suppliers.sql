-- Suppliers: the third-party businesses that fulfil CardPop shop stock.
--
-- CardPop sells some shop_products it does not hold itself (the Palms Off
-- Gaming ranges seeded in 20260825014051 / 20260825023045). Those are
-- drop-shipped: the buyer pays CardPop, and the supplier picks, packs and posts
-- the parcel straight to the buyer. Until now the only hint of who supplies a
-- product was shop_products.brand, which is a *display* field — an editor
-- renaming a brand for the storefront would silently re-route fulfilment.
--
-- This gives fulfilment its own explicit link, so routing an order to a
-- supplier never depends on marketing copy.
--
-- Deliberately admin-only under RLS: a row holds another business's internal
-- ops address and trading terms, none of which belongs in a public read.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,

  -- Where fulfilment orders are emailed. NULLABLE on purpose: a supplier can be
  -- recorded and linked to products before its ops address is known, and the
  -- dispatch service treats "no address" as "not configured yet" and skips
  -- rather than guessing. Never seed this with a placeholder — a wrong address
  -- means a real customer's shipping details are emailed to a stranger.
  fulfilment_email text,

  -- Additional recipients copied on every dispatch (a warehouse alias, an
  -- account manager). Empty by default.
  cc_emails text[] not null default '{}'::text[],

  -- Blind shipping: the parcel must carry CardPop as the sender, with no
  -- supplier branding, invoice or marketing insert. `blind_shipping_note` is
  -- the free-text instruction reproduced verbatim in every dispatch email, so
  -- the wording can be agreed with the supplier and changed without a deploy.
  blind_shipping boolean not null default true,
  blind_shipping_note text,

  -- Inactive suppliers are never emailed. New suppliers start inactive so that
  -- linking products can be done and reviewed before any mail goes out.
  active boolean not null default false,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One supplier per name, case-insensitively — stops a second "Palms Off Gaming"
-- being created alongside the first and splitting its products across two rows.
create unique index if not exists idx_suppliers_name_lower on public.suppliers (lower(name));
create index if not exists idx_suppliers_active on public.suppliers (active) where active = true;

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_admin_all" on public.suppliers;
create policy "suppliers_admin_all"
  on public.suppliers for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- ── Link products to their supplier ──────────────────────────────────────────
-- on delete set null: removing a supplier must never delete saleable stock. The
-- products simply stop being drop-shipped and fall back to manual fulfilment.
alter table public.shop_products
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

-- Partial: the dispatch path only ever asks for rows that HAVE a supplier.
create index if not exists idx_shop_products_supplier
  on public.shop_products (supplier_id) where supplier_id is not null;

-- ── Palms Off Gaming ─────────────────────────────────────────────────────────
-- Seeded as a stub: active = false and no fulfilment_email, because the real
-- ops address is not known here and must be entered deliberately. Products are
-- linked now so the association is under migration control rather than done by
-- hand in the dashboard; nothing is emailed until an admin supplies the address
-- and activates the row.
insert into public.suppliers (name, blind_shipping, blind_shipping_note, active, notes)
values (
  'Palms Off Gaming',
  true,
  'BLIND SHIP: please send with CardPop as the sender. No Palms Off Gaming branding, invoices, pricing or marketing inserts in the parcel.',
  false,
  'Stub created by migration. Set fulfilment_email and flip active = true to start sending dispatch emails.'
)
on conflict do nothing;

update public.shop_products sp
   set supplier_id = s.id
  from public.suppliers s
 where s.name = 'Palms Off Gaming'
   and sp.brand = 'Palms Off Gaming'
   and sp.supplier_id is null;
