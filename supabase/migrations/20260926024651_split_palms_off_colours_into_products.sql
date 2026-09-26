-- One shop product per colour, linked into a colour family.
--
-- Palms Off Gaming multi-colour lines were one shop_products row with a
-- shop_product_variants row per colour, so the shop grid showed a single card
-- per line and every colour shared the line's price. Each colour SKU is now
-- its own product — its own grid card, price, stock, barcode, cost and photos —
-- and siblings share `family_sku` (the line's SKU, e.g. 'ZB-04') so product
-- pages can switch between colours. See docs/shop-variants.md.
--
-- Idempotent: colour products are only inserted when their SKU doesn't exist
-- yet, and every update is guarded, so a re-run changes nothing.

-- 1. Columns ---------------------------------------------------------------
alter table public.shop_products add column if not exists family_sku text;
alter table public.shop_products add column if not exists colour text;
alter table public.shop_products add column if not exists colour_hex text;
alter table public.shop_products add column if not exists barcode text;
create index if not exists idx_shop_products_family_sku on public.shop_products (family_sku) where family_sku is not null;

comment on column public.shop_products.family_sku is
  'Groups colour siblings of one product line (the line SKU, e.g. ZB-04). Product pages show sibling colours as a picker.';
comment on column public.shop_products.colour is 'Display colour of this product within its family.';
comment on column public.shop_products.barcode is 'EAN printed on the packaging (publicly readable, like the SKU).';

-- 2. One product per active colour variant of a multi-colour Palms Off line --
with lines as (
  select p.*
  from public.shop_products p
  where p.brand = 'Palms Off Gaming'
    and (select count(*) from public.shop_product_variants v
         where v.product_id = p.id and v.status = 'active' and v.colour is not null) > 1
),
colour_photos as (
  -- The supplier's per-colour photos are named "<COLOUR SKU>_<view>.png".
  select v.id as variant_id,
         jsonb_agg(
           'https://vrfsaazuqjxotnieqlkd.supabase.co/storage/v1/object/public/palms%20off%20gaming%20products/'
             || replace(replace(o.name, ' ', '%20'), '&', '%26')
           order by case
             when o.name ~* '_(front|hero|pkg1)\.(png|jpe?g)$' then 0
             when o.name ~* '_profile\.(png|jpe?g)$' then 1
             else 2 end,
           o.name
         ) as images
  from public.shop_product_variants v
  join lines l on l.id = v.product_id
  join storage.objects o
    on o.bucket_id = 'palms off gaming products'
   and o.name ~* '\.(png|jpe?g)$'
   and position(v.sku || '_' in regexp_replace(o.name, '^.*/', '')) = 1
  group by v.id
)
insert into public.shop_products (
  sku, title, description, price_aud, retail_price_aud, stock_quantity, product_type,
  category, brand, status, slug, images, image_url, created_by,
  family_sku, colour, colour_hex, barcode
)
select
  v.sku,
  l.title || ' — ' || v.colour,
  l.description,
  coalesce(v.price_aud, l.price_aud),
  l.retail_price_aud,
  v.stock_quantity,
  l.product_type,
  l.category,
  l.brand,
  l.status,
  case when l.slug is null then null
       else l.slug || '-' || trim(both '-' from lower(regexp_replace(v.colour, '[^a-zA-Z0-9]+', '-', 'g'))) end,
  coalesce(cp.images, l.images),
  coalesce(cp.images->>0, l.image_url),
  l.created_by,
  l.sku,
  v.colour,
  v.colour_hex,
  v.barcode
from lines l
join public.shop_product_variants v on v.product_id = l.id and v.status = 'active' and v.colour is not null
left join colour_photos cp on cp.variant_id = v.id
where not exists (select 1 from public.shop_products x where upper(x.sku) = upper(v.sku));

-- 3. Each colour product starts with its line's wholesale cost --------------
insert into public.shop_product_costs (product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier, supplier_sku, source, notes)
select c.id, pc.wholesale_ex_gst_aud, pc.wholesale_inc_gst_aud, pc.supplier, c.sku, pc.source,
       'Copied from line ' || c.family_sku || ' when colours became separate products'
from public.shop_products c
join public.shop_products l on upper(l.sku) = upper(c.family_sku)
join public.shop_product_costs pc on pc.product_id = l.id
where c.family_sku is not null
on conflict (product_id) do nothing;

-- 4. Retire the combined line rows and their colour variants ----------------
-- Archived, not deleted: past orders reference them.
update public.shop_product_variants v
set status = 'archived', updated_at = now()
where v.status = 'active'
  and exists (select 1 from public.shop_products c where upper(c.sku) = upper(v.sku) and c.family_sku is not null);

update public.shop_products l
set status = 'archived', updated_at = now()
where l.status <> 'archived'
  and exists (select 1 from public.shop_products c where c.family_sku = l.sku)
  and not exists (select 1 from public.shop_product_variants v where v.product_id = l.id and v.status = 'active');

-- 5. Single-version lines: their one colourless "variant" only duplicated the
-- product (same SKU) and drew a one-chip colour picker. Keep its barcode on
-- the product and retire it, which returns stock to the product row.
update public.shop_products p
set barcode = v.barcode, updated_at = now()
from public.shop_product_variants v
where v.product_id = p.id and v.status = 'active' and v.colour is null
  and upper(v.sku) = upper(p.sku) and p.barcode is null and v.barcode is not null
  and (select count(*) from public.shop_product_variants w where w.product_id = p.id and w.status = 'active') = 1;

update public.shop_product_variants v
set status = 'archived', updated_at = now()
from public.shop_products p
where v.product_id = p.id and v.status = 'active' and v.colour is null
  and upper(v.sku) = upper(p.sku)
  and (select count(*) from public.shop_product_variants w where w.product_id = p.id and w.status = 'active') = 1;
