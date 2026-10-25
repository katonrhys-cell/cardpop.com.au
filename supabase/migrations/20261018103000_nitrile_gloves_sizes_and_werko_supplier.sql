-- Nitrile gloves: Shield Right XtraGuard black heavy-duty, box of 100, sizes S–2XL.
--
-- The house product "Nitrile Handling Gloves - 50 Pack" (CP-GLOVES-NITRILE-50-PACK)
-- is now the Shield Right Black Nitrile XtraGuard heavy-duty glove, which comes
-- as a box of 100 in five sizes. This migration:
--
--   1. Renames the product (title, slug, SKU, brand) and re-prices it: RRP
--      $14.95 per box (retail_price_aud, shown struck through), selling at
--      $12.95 (price_aud). The slug change is recorded in
--      shop_product_slug_redirects by the shop_products_record_slug_change
--      trigger, so the old URL keeps working.
--   2. Adds one shop_product_variants row per size — Small, Medium, Large, XL,
--      2XL — so the shopper picks a size and stock is tracked per size. The
--      size lives in the `colour` column with no swatch; the storefront labels
--      the picker "Size" (variantKind() in utils/shopVariants.js). Variant SKUs
--      are Shield Right's per-box codes SR1361–SR1365; Werko's carton SKUs
--      (SR1361-10 … SR1365-10, ten boxes) are in the notes. Stock starts at
--      10 boxes per size (one Werko carton of each) — adjust in Admin → Products.
--   3. Records the supplier on the admin-only shop_product_costs row: the Werko
--      product page the gloves are ordered from (watched weekly for price
--      changes), carton SKUs, and the per-box cost worked from Werko's carton
--      price of $83.15 ex GST ($8.32 ex / $9.15 inc per box).
--
-- Idempotent: the rename is keyed on either SKU and refuses to collide with
-- another product's slug or SKU; variants upsert on their SKU; the cost row
-- upserts on product_id.

-- ── 1. Product ──────────────────────────────────────────────────────────────
update public.shop_products p set
  title = 'Black Nitrile Heavy Duty Gloves - Box of 100',
  slug = 'black-nitrile-heavy-duty-gloves-box-of-100',
  sku = 'CP-GLOVES-NITRILE-100-PACK',
  brand = 'Shield Right',
  retail_price_aud = 14.95,
  price_aud = 12.95,
  status = 'active',
  description = $copy$A box of 100 powder-free black nitrile gloves, heavy-duty XtraGuard grade, in sizes Small to 2XL. For breakers, sellers and graders who handle a lot of cards and want a fresh pair every session.

Nitrile is a thin synthetic glove that keeps skin oils and fingerprints off card surfaces while still letting you feel what you are doing. This heavy-duty black glove is thicker than a standard examination glove, so it stands up to a long session of sliding cards into tight semi-rigids and opening sealed product, and its fully textured surface gives a firm grip on a thin card lying flat on a table. Powder-free and latex-free, it leaves no residue on cards or sleeves. Being disposable, there is no washing and no risk of grit building up in the fabric.

Pick your size from Small to 2XL: a snug fit gives the best dexterity for sleeving and photographing cards, so size down if you are between sizes. Choose nitrile over our cotton inspection gloves for jobs that need grip and a guaranteed clean pair every time, such as a live break, a big grading prep session or photographing cards for marketplace listings. Cotton gloves are more comfortable for long, slow sorting and can be reused. A box of 100 single gloves covers plenty of sessions. Pair with anti-static cloths for dust and a centring tool for pre-grading.$copy$,
  updated_at = now()
where upper(p.sku) in ('CP-GLOVES-NITRILE-50-PACK', 'CP-GLOVES-NITRILE-100-PACK')
  and not exists (
    select 1 from public.shop_products q
    where q.id <> p.id
      and (q.slug = 'black-nitrile-heavy-duty-gloves-box-of-100' or upper(q.sku) = 'CP-GLOVES-NITRILE-100-PACK')
  );

-- ── 2. Sizes ────────────────────────────────────────────────────────────────
insert into public.shop_product_variants (product_id, sku, colour, stock_quantity, sort_order, notes)
select p.id, v.sku, v.size, 10, v.sort_order, v.notes
from (values
  ('SR1361', 'Small',  0, 'Werko carton SKU SR1361-10 (10 boxes of 100).'),
  ('SR1362', 'Medium', 1, 'Werko carton SKU SR1362-10 (10 boxes of 100).'),
  ('SR1363', 'Large',  2, 'Werko carton SKU SR1363-10 (10 boxes of 100).'),
  ('SR1364', 'XL',     3, 'Werko carton SKU SR1364-10 (10 boxes of 100).'),
  ('SR1365', '2XL',    4, 'Werko carton SKU SR1365-10 (10 boxes of 100).')
) as v(sku, size, sort_order, notes)
join public.shop_products p on upper(p.sku) in ('CP-GLOVES-NITRILE-100-PACK', 'CP-GLOVES-NITRILE-50-PACK')
on conflict (sku) do update
  set product_id = excluded.product_id,
      colour = excluded.colour,
      sort_order = excluded.sort_order,
      notes = excluded.notes,
      status = 'active';

-- ── 3. Supplier: Werko product page + per-box cost ──────────────────────────
insert into public.shop_product_costs (product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier, supplier_sku, supplier_url, source, notes)
select p.id, 8.32, 9.15, 'Werko',
       'SR1361-10 / SR1362-10 / SR1363-10 / SR1364-10 / SR1365-10',
       'https://werko.com.au/products/shield-right-black-nitrile-xtraguard-disposable-gloves-heavy-duty',
       'werko.com.au product page (18 Oct 2026)',
       'Werko sells by the carton of 10 boxes at $83.15 ex GST ($91.47 inc); the cost here is per box. The weekly price watch reads the carton price, so a change there means the per-box cost needs re-working.'
from public.shop_products p
where upper(p.sku) in ('CP-GLOVES-NITRILE-100-PACK', 'CP-GLOVES-NITRILE-50-PACK')
on conflict (product_id) do update
  set wholesale_ex_gst_aud = excluded.wholesale_ex_gst_aud,
      wholesale_inc_gst_aud = excluded.wholesale_inc_gst_aud,
      supplier = excluded.supplier,
      supplier_sku = excluded.supplier_sku,
      supplier_url = excluded.supplier_url,
      source = excluded.source,
      notes = excluded.notes,
      updated_at = now();
