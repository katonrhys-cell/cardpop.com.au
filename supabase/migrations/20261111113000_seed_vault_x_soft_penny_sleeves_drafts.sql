-- Vault X Soft Penny Sleeves (clear), 400 and 1000 pack, added as DRAFTS.
--
-- One product page with a pack-size picker (family_sku VX-SOFT-PENNY), the same
-- way the Amazon AU listing shows it. Each price is the Amazon AU price on
-- 2026-11-11 + 25%, rounded UP to the next 5c:
--
--   400 pack    $27.52 -> $34.40
--   1000 pack   $22.95 -> $28.6875 -> $28.70
--
-- Both are `status = 'draft'` with stock 0 and no photos, so nothing shows in
-- the storefront until an admin has uploaded photos (through the product form,
-- so the grid thumbnails are made) and set stock in Admin -> Products. SKUs are
-- left to the CP-... trigger default for an admin to replace with the number
-- on the packaging.
--
-- Idempotent: a row is inserted only if no product already has its slug, so a
-- re-run adds nothing and never overwrites an admin's edits.

with v(title, description, price_aud, slug, colour) as (
  values
  ('Vault X Soft Penny Sleeves — Clear – 400 Pack',
   'Vault X clear soft penny sleeves for standard-size trading cards. 400 sleeves per order (two packs of 200), each 66 x 92 mm, for cards up to 63 x 88 mm. Made from 40 micron polypropylene: high clarity, durable, acid-free and PVC-free, so they are safe for archival storage and for grading submissions. The flexible easy-fit design makes packing sleeves fast. Pair with Vault X rigid and semi-rigid card holders.',
   34.40, 'vault-x-soft-penny-sleeves-clear-400-pack', 'Clear – 400 Pack'),

  ('Vault X Soft Penny Sleeves — Clear – 1000 Pack',
   'Vault X clear soft penny sleeves for standard-size trading cards, in a bulk 1000 pack (five packs of 200), each sleeve 66 x 92 mm, for cards up to 63 x 88 mm. Made from 40 micron polypropylene: high clarity, durable, acid-free and PVC-free, so they are safe for archival storage and for grading submissions. The flexible easy-fit design makes packing sleeves fast. The best value per sleeve for everyday protection of a large collection.',
   28.70, 'vault-x-soft-penny-sleeves-clear-1000-pack', 'Clear – 1000 Pack')
)
insert into public.shop_products (
  title, description, price_aud, stock_quantity, product_type, category,
  brand, slug, status, family_sku, colour
)
select v.title, v.description, v.price_aud, 0, 'accessory', 'Penny Sleeves',
       'Vault X', v.slug, 'draft', 'VX-SOFT-PENNY', v.colour
from v
where not exists (select 1 from public.shop_products p where p.slug = v.slug);

-- ── Cost (admin-only) ─────────────────────────────────────────────────────────
-- Cost = the Amazon AU price (GST-inclusive) on 2026-11-11, so Admin -> Products
-- shows the 25% margin. The Amazon links are left for an admin to paste in (the
-- listing's ASIN wasn't captured). Only blanks are filled.
with c(slug, cost_inc) as (
  values
  ('vault-x-soft-penny-sleeves-clear-400-pack',  27.52),
  ('vault-x-soft-penny-sleeves-clear-1000-pack', 22.95)
)
insert into public.shop_product_costs (
  product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier, source
)
select p.id, round(c.cost_inc / 1.1, 2), c.cost_inc, 'Amazon AU', 'Amazon AU listing, 2026-11-11'
from c
join public.shop_products p on p.slug = c.slug
on conflict (product_id) do update
  set wholesale_ex_gst_aud = coalesce(public.shop_product_costs.wholesale_ex_gst_aud, excluded.wholesale_ex_gst_aud),
      wholesale_inc_gst_aud = coalesce(public.shop_product_costs.wholesale_inc_gst_aud, excluded.wholesale_inc_gst_aud),
      supplier = coalesce(public.shop_product_costs.supplier, excluded.supplier),
      source = coalesce(public.shop_product_costs.source, excluded.source);
