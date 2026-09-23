-- Colour variants (with barcodes and per-variant stock) for shop products.
--
-- The supplier sells most Palms Off Gaming lines in several colours, each with
-- its own SKU and EAN barcode. Until now the shop had one row per line and no
-- way to pick a colour or track stock per colour. This adds:
--
--   1. shop_product_variants — one row per sellable unit (colour) of a product.
--      A product with no variant rows behaves exactly as before (stock and
--      price on shop_products). A product WITH variants derives its stock from
--      the sum of its active variants (trigger below) and flags has_variants so
--      the storefront asks for a colour before Add to Cart.
--   2. decrement_shop_variant_stock(variant, qty) — the per-variant twin of
--      decrement_shop_stock, used by the Stripe webhook when an order line
--      carries variant_id. Returns false (and changes nothing) on oversell.
--   3. RLS: variants of publicly visible products are publicly readable
--      (barcodes are printed on the packaging — not sensitive); admins manage.
--   4. Seed: 190 variants from the Palms Off Gaming order form (SEP 2026),
--      matched to products by shop_products.sku. Single-colour lines get one
--      variant using the product's own SKU; multi-colour lines get the
--      supplier's per-colour SKU. Stock starts at 0 (nothing is on sale yet).
--
-- Idempotent throughout (if not exists / create or replace / on conflict).

-- ── 1. Table ────────────────────────────────────────────────────────────────
create table if not exists public.shop_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products(id) on delete cascade,
  sku text not null,
  barcode text,
  colour text,
  colour_hex text,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  price_aud numeric(10,2) check (price_aud is null or price_aud >= 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_product_variants_sku_key unique (sku)
);

create unique index if not exists shop_product_variants_barcode_key
  on public.shop_product_variants (barcode) where barcode is not null;
create index if not exists idx_shop_product_variants_product on public.shop_product_variants (product_id);

comment on table public.shop_product_variants is
  'Sellable units (colours) of a shop product: own SKU, EAN barcode, stock. price_aud null = use the product price. A product with variants derives stock_quantity from them.';

alter table public.shop_products add column if not exists has_variants boolean not null default false;

-- ── 2. Normalise + keep the parent in sync ──────────────────────────────────
create or replace function public.shop_product_variants_normalise()
returns trigger language plpgsql set search_path = public as $$
begin
  new.sku := upper(btrim(coalesce(new.sku, '')));
  if new.sku = '' then raise exception 'variant sku is required'; end if;
  new.barcode := nullif(regexp_replace(coalesce(new.barcode, ''), '\s', '', 'g'), '');
  new.colour := nullif(btrim(coalesce(new.colour, '')), '');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists shop_product_variants_normalise on public.shop_product_variants;
create trigger shop_product_variants_normalise
  before insert or update on public.shop_product_variants
  for each row execute function public.shop_product_variants_normalise();

-- Parent stock = sum of ACTIVE variant stock; has_variants = any active variant.
create or replace function public.shop_products_sync_from_variants()
returns trigger language plpgsql set search_path = public as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
  n integer;
  total integer;
begin
  select count(*), coalesce(sum(stock_quantity), 0) into n, total
  from public.shop_product_variants where product_id = pid and status = 'active';
  if n > 0 then
    update public.shop_products set stock_quantity = total, has_variants = true, updated_at = now()
    where id = pid and (stock_quantity <> total or has_variants is distinct from true);
  else
    update public.shop_products set has_variants = false, updated_at = now()
    where id = pid and has_variants is distinct from false;
  end if;
  -- old/new product_id differ on a re-parent: sync the other side too
  if tg_op = 'UPDATE' and new.product_id <> old.product_id then
    select count(*), coalesce(sum(stock_quantity), 0) into n, total
    from public.shop_product_variants where product_id = old.product_id and status = 'active';
    update public.shop_products set stock_quantity = case when n > 0 then total else stock_quantity end, has_variants = (n > 0), updated_at = now()
    where id = old.product_id;
  end if;
  return null;
end $$;

drop trigger if exists shop_product_variants_sync_parent on public.shop_product_variants;
create trigger shop_product_variants_sync_parent
  after insert or update or delete on public.shop_product_variants
  for each row execute function public.shop_products_sync_from_variants();

-- ── 3. Stock decrement (webhook, service role only) ─────────────────────────
create or replace function public.decrement_shop_variant_stock(p_variant_id uuid, p_qty integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  updated integer;
begin
  update public.shop_product_variants
  set stock_quantity = stock_quantity - p_qty
  where id = p_variant_id and status = 'active' and stock_quantity >= p_qty;
  get diagnostics updated = row_count;
  return updated = 1;
end $$;

revoke execute on function public.decrement_shop_variant_stock(uuid, integer) from public;
revoke execute on function public.decrement_shop_variant_stock(uuid, integer) from anon;
revoke execute on function public.decrement_shop_variant_stock(uuid, integer) from authenticated;

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
alter table public.shop_product_variants enable row level security;

drop policy if exists "shop_product_variants_select" on public.shop_product_variants;
create policy "shop_product_variants_select" on public.shop_product_variants for select to public
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    or exists (select 1 from public.shop_products sp where sp.id = product_id and sp.status in ('active', 'coming_soon'))
  );

drop policy if exists "shop_product_variants_admin_write" on public.shop_product_variants;
create policy "shop_product_variants_admin_write" on public.shop_product_variants for all to public
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

-- ── 5. Seed: Palms Off Gaming order form, September 2026 ────────────────────
insert into public.shop_product_variants (product_id, sku, barcode, colour, colour_hex, sort_order, notes)
select p.id, v.sku, v.barcode, v.colour, v.colour_hex, v.sort_order, v.notes
from (values
  ('ZB-04', 'ZB-04-BLK', '1209202001436', 'Black', '#1B1B1D', 0, null),
  ('ZB-04', 'ZB-04-BLU', '1209202001450', 'Blue', '#2E6FD9', 1, null),
  ('ZB-04', 'ZB-04-PNK', '1209202001474', 'Pink', '#E56BA3', 2, null),
  ('ZB-04', 'ZB-04-PUR', '1209202001481', 'Purple', '#7A4FB5', 3, null),
  ('ZB-04', 'ZB-04-RED', '1209202001443', 'Red', '#C8202F', 4, null),
  ('ZB-04', 'ZB-04-TQS', '1209202001467', 'Turquoise', '#2FB3AE', 5, null),
  ('ZB-04', 'ZB-04-YEL', '1209202023490', 'Yellow', '#E8B93B', 6, null),
  ('ZB-04', 'ZB-04-GRN', '9361977002895', 'Green', null, 7, null),
  ('ZB-09', 'ZB-09-BLK', '1209202001375', 'Black', '#1B1B1D', 0, null),
  ('ZB-09', 'ZB-09-BLU', '1209202001399', 'Blue', '#2E6FD9', 1, null),
  ('ZB-09', 'ZB-09-PNK', '1209202001412', 'Pink', '#E56BA3', 2, null),
  ('ZB-09', 'ZB-09-PUR', '1209202001429', 'Purple', '#7A4FB5', 3, null),
  ('ZB-09', 'ZB-09-RED', '1209202001382', 'Red', '#C8202F', 4, null),
  ('ZB-09', 'ZB-09-TQS', '1209202001405', 'Turquoise', '#2FB3AE', 5, null),
  ('ZB-09', 'ZB-09-YEL', '1209202023483', 'Yellow', '#E8B93B', 6, null),
  ('ZB-09', 'ZB-09-GRN', '9361977002901', 'Green', null, 7, null),
  ('ZB-12', 'ZB-12-BLK', '1209202001313', 'Black', '#1B1B1D', 0, null),
  ('ZB-12', 'ZB-12-BLU', '1209202001337', 'Blue', '#2E6FD9', 1, null),
  ('ZB-12', 'ZB-12-PNK', '1209202001368', 'Pink', '#E56BA3', 2, null),
  ('ZB-12', 'ZB-12-PUR', '1209202001542', 'Purple', '#7A4FB5', 3, null),
  ('ZB-12', 'ZB-12-RED', '1209202001320', 'Red', '#C8202F', 4, null),
  ('ZB-12', 'ZB-12-TQS', '1209202001351', 'Turquoise', '#2FB3AE', 5, null),
  ('ZB-12', 'ZB-12-YEL', '1209202023476', 'Yellow', '#E8B93B', 6, null),
  ('ZB-12', 'ZB-12-GRN', '9361977002918', 'Green', null, 7, null),
  ('STL-09', 'STL-09-BLK', '1209202001993', 'Black', '#1B1B1D', 0, null),
  ('STL-09', 'STL-09-BLU', '1209202023018', 'Blue', '#2E6FD9', 1, null),
  ('STL-09', 'STL-09-PNK', '1209202023032', 'Pink', '#E56BA3', 2, null),
  ('STL-09', 'STL-09-PUR', '1209202023056', 'Purple', '#7A4FB5', 3, null),
  ('STL-09', 'STL-09-RED', '1209202023070', 'Red', '#C8202F', 4, null),
  ('STL-09', 'STL-09-TQS', '1209202023094', 'Turquoise', '#2FB3AE', 5, null),
  ('STL-09', 'STL-09-YEL', '1209202002204', 'Yellow', '#E8B93B', 6, null),
  ('STL-12', 'STL-12-BLK', '1209202023001', 'Black', '#1B1B1D', 0, null),
  ('STL-12', 'STL-12-BLU', '1209202023025', 'Blue', '#2E6FD9', 1, null),
  ('STL-12', 'STL-12-PNK', '1209202023049', 'Pink', '#E56BA3', 2, null),
  ('STL-12', 'STL-12-PUR', '1209202023063', 'Purple', '#7A4FB5', 3, null),
  ('STL-12', 'STL-12-RED', '1209202023087', 'Red', '#C8202F', 4, null),
  ('STL-12', 'STL-12-TQS', '1209202023100', 'Turquoise', '#2FB3AE', 5, null),
  ('STL-12', 'STL-12-YEL', '1209202002211', 'Yellow', '#E8B93B', 6, null),
  ('TOP-04', 'TOP-04-BLK', '9361977002635', 'Black', '#1B1B1D', 0, null),
  ('TOP-04', 'TOP-04-BLU', '9361977002642', 'Blue', '#2E6FD9', 1, null),
  ('TOP-04', 'TOP-04-PNK', '9361977002666', 'Pink', '#E56BA3', 2, null),
  ('TOP-04', 'TOP-04-PUR', '9361977002673', 'Purple', '#7A4FB5', 3, null),
  ('TOP-04', 'TOP-04-RED', '9361977002680', 'Red', '#C8202F', 4, null),
  ('TOP-04', 'TOP-04-TQS', '9361977002697', 'Turquoise', '#2FB3AE', 5, null),
  ('TOP-04', 'TOP-04-YEL', '9361977002703', 'Yellow', '#E8B93B', 6, null),
  ('TOP-04', 'TOP-04-GRN', '9361977002925', 'Green', null, 7, null),
  ('TOP-09', 'TOP-09-BLK', '1209202023117', 'Black', '#1B1B1D', 0, null),
  ('TOP-09', 'TOP-09-BLU', '1209202023223', 'Blue', '#2E6FD9', 1, null),
  ('TOP-09', 'TOP-09-PNK', '1209202023230', 'Pink', '#E56BA3', 2, null),
  ('TOP-09', 'TOP-09-PUR', '1209202023247', 'Purple', '#7A4FB5', 3, null),
  ('TOP-09', 'TOP-09-RED', '1209202023254', 'Red', '#C8202F', 4, null),
  ('TOP-09', 'TOP-09-TQS', '1209202023261', 'Turquoise', '#2FB3AE', 5, null),
  ('TOP-09', 'TOP-09-YEL', '1209202023278', 'Yellow', '#E8B93B', 6, null),
  ('TOP-09', 'TOP-09-GRN', '936177002932', 'Green', null, 7, null),
  ('RB-BLK', 'RB-BLK', '1209202002112', null, null, 0, null),
  ('GCC-S', 'GCC-S-BLK', '1209202001511', 'Black', '#1B1B1D', 0, null),
  ('GCC-S', 'GCC-S-BLU', '1209202023407', 'Blue', '#2E6FD9', 1, null),
  ('GCC-S', 'GCC-S-PNK', '1209202023414', 'Pink', '#E56BA3', 2, null),
  ('GCC-S', 'GCC-S-PUR', '1209202023421', 'Purple', '#7A4FB5', 3, null),
  ('GCC-S', 'GCC-S-RED', '1209202023438', 'Red', '#C8202F', 4, null),
  ('GCC-S', 'GCC-S-TQS', '1209202023445', 'Turquoise', '#2FB3AE', 5, null),
  ('GCC-S', 'GCC-S-YEL', '1209202023452', 'Yellow', '#E8B93B', 6, null),
  ('GCC-M', 'GCC-M-BLK', '1209202001504', 'Black', '#1B1B1D', 0, null),
  ('GCC-M', 'GCC-M-BLU', '1209202023346', 'Blue', '#2E6FD9', 1, null),
  ('GCC-M', 'GCC-M-PNK', '1209202023353', 'Pink', '#E56BA3', 2, null),
  ('GCC-M', 'GCC-M-PUR', '1209202023360', 'Purple', '#7A4FB5', 3, null),
  ('GCC-M', 'GCC-M-RED', '1209202023377', 'Red', '#C8202F', 4, null),
  ('GCC-M', 'GCC-M-TQS', '1209202023384', 'Turquoise', '#2FB3AE', 5, null),
  ('GCC-M', 'GCC-M-YEL', '1209202023391', 'Yellow', '#E8B93B', 6, null),
  ('GCC-L', 'GCC-L-BLK', '1209202001498', 'Black', '#1B1B1D', 0, null),
  ('GCC-L', 'GCC-L-BLU', '1209202023285', 'Blue', '#2E6FD9', 1, null),
  ('GCC-L', 'GCC-L-PNK', '1209202023292', 'Pink', '#E56BA3', 2, null),
  ('GCC-L', 'GCC-L-PUR', '1209202023308', 'Purple', '#7A4FB5', 3, null),
  ('GCC-L', 'GCC-L-RED', '1209202023315', 'Red', '#C8202F', 4, null),
  ('GCC-L', 'GCC-L-TQS', '1209202023322', 'Turquoise', '#2FB3AE', 5, null),
  ('GCC-L', 'GCC-L-YEL', '1209202023339', 'Yellow', '#E8B93B', 6, null),
  ('DB-G', 'DB-G-BLK', '1209202001870', 'Black', '#1B1B1D', 0, null),
  ('DB-G', 'DB-G-BLU', '1209202001887', 'Blue', '#2E6FD9', 1, null),
  ('DB-G', 'DB-G-PNK', '1209202001894', 'Pink', '#E56BA3', 2, null),
  ('DB-G', 'DB-G-PUR', '1209202001900', 'Purple', '#7A4FB5', 3, null),
  ('DB-G', 'DB-G-RED', '1209202001917', 'Red', '#C8202F', 4, null),
  ('DB-G', 'DB-G-TQS', '1209202001924', 'Turquoise', '#2FB3AE', 5, null),
  ('DB-G', 'DB-G-YEL', '1209202002105', 'Yellow', '#E8B93B', 6, null),
  ('PTL-N100', 'PTL-N100-BLK', '9361977002826', 'Black', '#1B1B1D', 0, null),
  ('PTL-N100', 'PTL-N100-BLU', '9361977002833', 'Blue', '#2E6FD9', 1, null),
  ('PTL-N100', 'PTL-N100-PNK', '9361977002840', 'Pink', '#E56BA3', 2, null),
  ('PTL-N100', 'PTL-N100-PUR', '9361977002857', 'Purple', '#7A4FB5', 3, null),
  ('PTL-N100', 'PTL-N100-RED', '9361977002864', 'Red', '#C8202F', 4, null),
  ('PTL-N100', 'PTL-N100-TQS', '9361977002871', 'Turquoise', '#2FB3AE', 5, null),
  ('PTL-N100', 'PTL-N100-YEL', '9361977002888', 'Yellow', '#E8B93B', 6, null),
  ('CMD-10', 'CMD-10', '936197703038', null, null, 0, null),
  ('SCS-ST', 'SCS-ST', '1209202001559', null, null, 0, null),
  ('SCS-JPN', 'SCS-JPN', '1209202023179', null, null, 0, null),
  ('TAG-100', 'TAG-100', '1209202001825', null, null, 0, null),
  ('TEAM-100', 'TEAM-100', '1209202001580', null, null, 0, null),
  ('MF-BGS-REG', 'MF-BGS-REG', '1209202001269', null, null, 0, null),
  ('MF-PACK-EX', 'MF-PACK-EX', '1209202001283', null, null, 0, null),
  ('MF-IN-JPN', 'MF-IN-JPN', '1209202002228', null, null, 0, null),
  ('MF-SLIN-ST', 'MF-SLIN-ST', '9361977000815', null, null, 0, null),
  ('MF-IN-ST', 'MF-IN-ST', '1209202001818', null, null, 0, null),
  ('MF-SLIN-JPN', 'MF-SLIN-JPN', '9361977000822', null, null, 0, null),
  ('MF-MAG-35', 'MF-MAG-35', '1209202023155', null, null, 0, null),
  ('MF-MAG-130', 'MF-MAG-130', '1209202023162', null, null, 0, null),
  ('MF-PSA-EX', 'MF-PSA-EX', '1209202001252', null, null, 0, null),
  ('MF-PSA-REG', 'MF-PSA-REG', '1209202001245', null, null, 0, null),
  ('PROS-ST-CLR', 'PROS-ST-CLR', '9361977001515', null, null, 0, null),
  ('BODS-ST', 'BODS-ST-BLK', '9361977000884', 'Black', '#1B1B1D', 0, null),
  ('BODS-ST', 'BODS-ST-BLU', '9361977000891', 'Blue', '#2E6FD9', 1, null),
  ('BODS-ST', 'BODS-ST-CLR', '9361977000907', 'Clear', null, 2, null),
  ('BODS-ST', 'BODS-ST-GRN', '9361977000914', 'Green', null, 3, null),
  ('BODS-ST', 'BODS-ST-PNK', '9361977000952', 'Pink', '#E56BA3', 4, null),
  ('BODS-ST', 'BODS-ST-PUR', '9361977000969', 'Purple', '#7A4FB5', 5, null),
  ('BODS-ST', 'BODS-ST-RED', '9361977000976', 'Red', '#C8202F', 6, null),
  ('BODS-ST', 'BODS-ST-TQS', '9361977000990', 'Turquoise', '#2FB3AE', 7, null),
  ('BODS-ST', 'BODS-ST-WHI', '9361977001003', 'White', null, 8, null),
  ('BODS-ST', 'BODS-ST-YEL', '9361977001010', 'Yellow', '#E8B93B', 9, null),
  ('BODS-ST', 'BODS-ST-JDE', '9361977000921', 'Jade', null, 10, null),
  ('BODS-ST', 'BODS-ST-ROS', '9361977000983', 'Rose', null, 11, null),
  ('BODS-ST', 'BODS-ST-ORA', '9361977000945', 'Orange', null, 12, null),
  ('BODS-ST', 'BODS-ST-NAV', '9361977000938', 'Navy', '#1E2A4A', 13, null),
  ('PROS-ST-MAT', 'PROS-ST-MAT', '9361977001522', null, null, 0, null),
  ('BODS-ST-M', 'BODS-ST-BLK-M', '9361977001799', 'Black', '#1B1B1D', 0, null),
  ('BODS-ST-M', 'BODS-ST-BLU-M', '9361977001805', 'Blue', '#2E6FD9', 1, null),
  ('BODS-ST-M', 'BODS-ST-CLR-M', '9361977001812', 'Clear', null, 2, null),
  ('BODS-ST-M', 'BODS-ST-GRN-M', '9361977001829', 'Green', null, 3, null),
  ('BODS-ST-M', 'BODS-ST-PNK-M', '9361977001867', 'Pink', '#E56BA3', 4, null),
  ('BODS-ST-M', 'BODS-ST-PUR-M', '9361977001874', 'Purple', '#7A4FB5', 5, null),
  ('BODS-ST-M', 'BODS-ST-RED-M', '9361977001881', 'Red', '#C8202F', 6, null),
  ('BODS-ST-M', 'BODS-ST-TQS-M', '9361977001904', 'Turquoise', '#2FB3AE', 7, null),
  ('BODS-ST-M', 'BODS-ST-WHI-M', '9361977001911', 'White', null, 8, null),
  ('BODS-ST-M', 'BODS-ST-YEL-M', '9361977001928', 'Yellow', '#E8B93B', 9, null),
  ('BODS-ST-M', 'BODS-ST-JDE-M', '9361977001836', 'Jade', null, 10, null),
  ('BODS-ST-M', 'BODS-ST-ROS-M', '9361977001898', 'Rose', null, 11, null),
  ('BODS-ST-M', 'BODS-ST-ORA-M', '9361977001850', 'Orange', null, 12, null),
  ('BODS-ST-M', 'BODS-ST-NAV-M', '9361977001843', 'Navy', '#1E2A4A', 13, null),
  ('PROS-JPN-CLR', 'PROS-JPN-CLR', '9361977001539', null, null, 0, null),
  ('BODS-JPN', 'BODS-JPN-BLK', '9361977001027', 'Black', '#1B1B1D', 0, null),
  ('BODS-JPN', 'BODS-JPN-BLU', '9361977001034', 'Blue', '#2E6FD9', 1, null),
  ('BODS-JPN', 'BODS-JPN-CLR', '9361977001041', 'Clear', null, 2, null),
  ('BODS-JPN', 'BODS-JPN-GRN', '9361977001058', 'Green', null, 3, null),
  ('BODS-JPN', 'BODS-JPN-PNK', '9361977001096', 'Pink', '#E56BA3', 4, null),
  ('BODS-JPN', 'BODS-JPN-PUR', '9361977001102', 'Purple', '#7A4FB5', 5, null),
  ('BODS-JPN', 'BODS-JPN-RED', '9361977001119', 'Red', '#C8202F', 6, null),
  ('BODS-JPN', 'BODS-JPN-TQS', '9361977001133', 'Turquoise', '#2FB3AE', 7, null),
  ('BODS-JPN', 'BODS-JPN-WHI', '9361977001140', 'White', null, 8, null),
  ('BODS-JPN', 'BODS-JPN-YEL', '9361977001157', 'Yellow', '#E8B93B', 9, null),
  ('BODS-JPN', 'BODS-JPN-JDE', '9361977001065', 'Jade', null, 10, null),
  ('BODS-JPN', 'BODS-JPN-ROS', '9361977001126', 'Rose', null, 11, null),
  ('BODS-JPN', 'BODS-JPN-ORA', '9361977001089', 'Orange', null, 12, null),
  ('BODS-JPN', 'BODS-JPN-NAV', '9361977001072', 'Navy', '#1E2A4A', 13, null),
  ('PROS-JPN-MAT', 'PROS-JPN-MAT', '9361977001546', null, null, 0, null),
  ('BODS-JPN-M', 'BODS-JPN-BLK-M', '9361977001935', 'Black', '#1B1B1D', 0, null),
  ('BODS-JPN-M', 'BODS-JPN-BLU-M', '9361977001942', 'Blue', '#2E6FD9', 1, null),
  ('BODS-JPN-M', 'BODS-JPN-CLR-M', '9361977001959', 'Clear', null, 2, null),
  ('BODS-JPN-M', 'BODS-JPN-GRN-M', '9361977001966', 'Green', null, 3, null),
  ('BODS-JPN-M', 'BODS-JPN-PNK-M', '9361977002000', 'Pink', '#E56BA3', 4, null),
  ('BODS-JPN-M', 'BODS-JPN-PUR-M', '9361977002017', 'Purple', '#7A4FB5', 5, null),
  ('BODS-JPN-M', 'BODS-JPN-RED-M', '9361977002024', 'Red', '#C8202F', 6, null),
  ('BODS-JPN-M', 'BODS-JPN-TQS-M', '9361977002048', 'Turquoise', '#2FB3AE', 7, null),
  ('BODS-JPN-M', 'BODS-JPN-WHI-M', '9361977002055', 'White', null, 8, null),
  ('BODS-JPN-M', 'BODS-JPN-YEL-M', '9361977002062', 'Yellow', '#E8B93B', 9, null),
  ('BODS-JPN-M', 'BODS-JPN-JDE-M', '9361977001973', 'Jade', null, 10, null),
  ('BODS-JPN-M', 'BODS-JPN-ROS-M', '9361977002031', 'Rose', null, 11, null),
  ('BODS-JPN-M', 'BODS-JPN-ORA-M', '9361977001997', 'Orange', null, 12, null),
  ('BODS-JPN-M', 'BODS-JPN-NAV-M', '9361977001980', 'Navy', '#1E2A4A', 13, null),
  ('PM-ST', 'PM-ST-BLK', '9361977001188', 'Black', '#1B1B1D', 0, null),
  ('PM-ST', 'PM-ST-BLU', '9361977001195', 'Blue', '#2E6FD9', 1, null),
  ('PM-ST', 'PM-ST-JDE', '9361977001201', 'Jade', null, 2, null),
  ('PM-ST', 'PM-ST-PNK', '9361977001218', 'Pink', '#E56BA3', 3, null),
  ('PM-ST', 'PM-ST-PUR', '9361977001225', 'Purple', '#7A4FB5', 4, null),
  ('PM-ST', 'PM-ST-RED', '9361977001232', 'Red', '#C8202F', 5, null),
  ('PM-ST', 'PM-ST-TQS', '9361977001249', 'Turquoise', '#2FB3AE', 6, null),
  ('PM-ST', 'PM-ST-YEL', '9361977001256', 'Yellow', '#E8B93B', 7, null),
  ('SRGH-200', 'SRGH-200', '1209202001573', null, null, 0, null),
  ('MAG-35PT', 'MAG-35PT', '1209202001696', null, null, 0, 'Barcode is the supplier''s 25pc display carton (MAG-35PT-IC); single units carry no barcode on the order form.'),
  ('MAG-55PT', 'MAG-55PT', '1209202001702', null, null, 0, 'Barcode is the supplier''s 25pc display carton (MAG-55PT-IC); single units carry no barcode on the order form.'),
  ('MAG-75PT', 'MAG-75PT', '1209202001719', null, null, 0, 'Barcode is the supplier''s 25pc display carton (MAG-75PT-IC); single units carry no barcode on the order form.'),
  ('MAG-100PT', 'MAG-100PT', '1209202001726', null, null, 0, 'Barcode is the supplier''s 25pc display carton (MAG-100PT-IC); single units carry no barcode on the order form.'),
  ('MAG-130PT', 'MAG-130PT', '1209202001733', null, null, 0, 'Barcode is the supplier''s 25pc display carton (MAG-130PT-IC); single units carry no barcode on the order form.'),
  ('MAG-180PT', 'MAG-180PT', '1209202001740', null, null, 0, 'Barcode is the supplier''s 20pc display carton (MAG-180PT-IC); single units carry no barcode on the order form.'),
  ('STS-100', 'STS-100', '1209202023186', null, null, 0, null),
  ('TL-35PT', 'TL-35PT', '1209202001597', null, null, 0, 'Supplier SKU CL-35PT.'),
  ('TL-55PT', 'TL-55PT', '1209202001610', null, null, 0, 'Supplier SKU CL-55PT.'),
  ('TL-75PT', 'TL-75PT', '1209202001627', null, null, 0, 'Supplier SKU CL-75PT.'),
  ('TL-100PT', 'TL-100PT', '1209202001634', null, null, 0, 'Supplier SKU CL-100PT.'),
  ('TL-130PT', 'TL-130PT', '1209202001641', null, null, 0, 'Supplier SKU CL-130PT.'),
  ('TL-180PT', 'TL-180PT', '1209202001658', null, null, 0, 'Supplier SKU CL-180PT.'),
  ('TL-PACK', 'TL-PACK', '1209202023124', null, null, 0, 'Supplier SKU BPL-10.'),
  ('MF-TL-35PT', 'MF-TL-35PT', '1209202023148', null, null, 0, 'Supplier SKU MF-CL-35PT.'),
  ('MF-TL-PACK', 'MF-TL-PACK', '1209202023131', null, null, 0, 'Supplier SKU MF-BPL.')
) as v(product_sku, sku, barcode, colour, colour_hex, sort_order, notes)
join public.shop_products p on upper(p.sku) = v.product_sku
on conflict (sku) do nothing;
