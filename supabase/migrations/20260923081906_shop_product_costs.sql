-- Wholesale cost price per shop product, admin-only.
--
-- Cost is commercially sensitive, so it does NOT live on shop_products: that
-- table's SELECT policy lets the public read every column of an active or
-- coming-soon row through the anon key. This table has RLS with admin-only
-- policies and no public policy at all, so the anon client gets nothing.
--
-- One row per product (product_id is the PK). Both GST bases are stored as
-- the supplier quotes them (the form's inc-GST figure is not always exactly
-- ex × 1.1 after rounding). Margin is derived in the admin UI, not stored.
--
-- Seeded from the Palms Off Gaming wholesale order form (September 2026),
-- matched by shop_products.sku; supplier_sku records the form's own SKU where
-- it differs (Top Loader lines map to the form's "Card Loader" rows; Mag Lock
-- cases are quoted per 25/20pc display carton and stored per unit).
--
-- Idempotent: create if not exists, policies dropped/recreated by name, seed
-- upserts on product_id.

create table if not exists public.shop_product_costs (
  product_id uuid primary key references public.shop_products(id) on delete cascade,
  wholesale_ex_gst_aud numeric(10,2) check (wholesale_ex_gst_aud is null or wholesale_ex_gst_aud >= 0),
  wholesale_inc_gst_aud numeric(10,2) check (wholesale_inc_gst_aud is null or wholesale_inc_gst_aud >= 0),
  supplier text,
  supplier_sku text,
  source text,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

comment on table public.shop_product_costs is
  'Admin-only wholesale cost per shop product. Never expose through a public policy or view.';

alter table public.shop_product_costs enable row level security;

drop policy if exists "shop_product_costs_admin_all" on public.shop_product_costs;
create policy "shop_product_costs_admin_all"
  on public.shop_product_costs for all
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

-- ── Seed: Palms Off Gaming order form, September 2026 ───────────────────────
insert into public.shop_product_costs (product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier, supplier_sku, source)
select p.id, v.ex, v.inc, 'Palms Off Gaming', nullif(v.supplier_sku, p.sku), 'Palms Off Gaming Order Form (SEP 2026)'
from (values
  ('BODS-JPN', 6.80, 7.48, 'BODS-JPN-*'),
  ('BODS-JPN-M', 6.80, 7.48, 'BODS-JPN-M-*'),
  ('BODS-ST', 7.70, 8.48, 'BODS-ST-*'),
  ('BODS-ST-M', 7.70, 8.48, 'BODS-ST-M-*'),
  ('CL-100PT', 4.96, 5.46, 'CL-100PT'),
  ('CL-180PT', 3.30, 3.65, 'CL-180PT'),
  ('CL-35PT', 3.32, 3.65, 'CL-35PT'),
  ('CMD-10', 9.54, 10.49, 'CMD-10'),
  ('DB-G', 16.32, 17.95, 'DB-G-*'),
  ('GCC-L', 29.06, 31.97, 'GCC-L-*'),
  ('GCC-M', 26.72, 29.39, 'GCC-M-*'),
  ('GCC-S', 18.14, 19.95, 'GCC-S-*'),
  ('MAG-100PT', 2.03, 2.23, 'MAG-100PT-IC'),
  ('MAG-130PT', 2.05, 2.26, 'MAG-130PT-IC'),
  ('MAG-180PT', 2.32, 2.55, 'MAG-180PT-IC'),
  ('MAG-35PT', 1.80, 1.98, 'MAG-35PT-IC'),
  ('MAG-55PT', 1.95, 2.15, 'MAG-55PT-IC'),
  ('MAG-75PT', 2.00, 2.20, 'MAG-75PT-IC'),
  ('MF-BGS-REG', 3.96, 4.35, 'MF-BGS-REG'),
  ('MF-IN-JPN', 2.50, 2.75, 'MF-IN-JPN'),
  ('MF-IN-ST', 2.50, 2.75, 'MF-IN-ST'),
  ('MF-MAG-130', 4.32, 4.75, 'MF-MAG-130'),
  ('MF-MAG-35', 4.32, 4.75, 'MF-MAG-35'),
  ('MF-PACK-EX', 3.96, 4.35, 'MF-PACK-EX'),
  ('MF-PSA-EX', 3.96, 4.35, 'MF-PSA-EX'),
  ('MF-PSA-REG', 3.96, 4.35, 'MF-PSA-REG'),
  ('MF-SLIN-JPN', 2.50, 2.75, 'MF-SLIN-JPN'),
  ('MF-SLIN-ST', 2.50, 2.75, 'MF-SLIN-ST'),
  ('MF-TL-35PT', 4.32, 4.75, 'MF-CL-35PT'),
  ('MF-TL-PACK', 3.77, 4.15, 'MF-BPL'),
  ('PM-ST', 12.97, 14.27, 'PM-ST-*'),
  ('PROS-JPN-CLR', 8.49, 9.34, 'PROS-JPN-CLR'),
  ('PROS-JPN-MAT', 8.49, 9.34, 'PROS-JPN-MAT'),
  ('PROS-ST-CLR', 8.49, 9.34, 'PROS-ST-CLR'),
  ('PROS-ST-MAT', 8.49, 9.34, 'PROS-ST-MAT'),
  ('PTL-N100', 22.15, 24.37, 'PTL-N100-*'),
  ('RB-BLK', 18.64, 20.50, 'RB-BLK'),
  ('SCS-JPN', 1.08, 1.19, 'SCS-JPN'),
  ('SCS-ST', 1.08, 1.19, 'SCS-ST'),
  ('SRGH-200', 24.50, 26.95, 'SRGH-200'),
  ('STL-09', 23.14, 25.45, 'STL-09-*'),
  ('STL-12', 25.41, 27.95, 'STL-12-*'),
  ('STS-100', 5.00, 5.50, 'STS-100'),
  ('TAG-100', 2.75, 3.03, 'TAG-100'),
  ('TEAM-100', 2.86, 3.15, 'TEAM-100'),
  ('TL-100PT', 4.96, 5.46, 'CL-100PT'),
  ('TL-130PT', 3.60, 3.97, 'CL-130PT'),
  ('TL-180PT', 3.30, 3.65, 'CL-180PT'),
  ('TL-35PT', 3.32, 3.65, 'CL-35PT'),
  ('TL-55PT', 4.16, 4.58, 'CL-55PT'),
  ('TL-75PT', 4.71, 5.25, 'CL-75PT'),
  ('TL-PACK', 5.52, 6.07, 'BPL-10'),
  ('TOP-04', 22.75, 25.02, 'TOP-04-*'),
  ('TOP-09', 33.79, 37.17, 'TOP-09-*'),
  ('ZB-04', 19.95, 21.95, 'ZB-04-*'),
  ('ZB-09', 26.32, 28.95, 'ZB-09-*'),
  ('ZB-12', 30.45, 33.50, 'ZB-12-*')
) as v(sku, ex, inc, supplier_sku)
join public.shop_products p on upper(p.sku) = v.sku
on conflict (product_id) do update
  set wholesale_ex_gst_aud = excluded.wholesale_ex_gst_aud,
      wholesale_inc_gst_aud = excluded.wholesale_inc_gst_aud,
      supplier = excluded.supplier,
      supplier_sku = excluded.supplier_sku,
      source = excluded.source,
      updated_at = now();
