-- Gamegenic Just Sleeves range, added to the shop as DRAFTS.
--
-- Every size, style and pack size of Gamegenic's entry-level Just Sleeves line
-- that could be confirmed, one shop_products row each, all `status = 'draft'`
-- so nothing appears in the storefront until an admin has reviewed it in
-- Admin → Products (photos, price, stock) and switched it to Active.
--
--   Card game sizes
--     Soft Sleeves (100)            clear penny sleeves for standard cards
--     Inner Sleeves (100)           64 x 89 mm, for double-sleeving
--     Standard Card Game (50)       66 x 92 mm — Clear, Black, Green, White, Blue
--                                   (one colour family: family_sku GG-JS-STANDARD-50)
--     Standard Value Pack (250)     66 x 92 mm, clear — the Amazon listing this
--                                   batch started from (supplier link below)
--     Japanese Size (60)            62 x 89 mm — Clear, Black, Red, Green, White, Pink
--                                   (one colour family: family_sku GG-JS-JAPANESE-60)
--   Board Game (clear) — one product page with a STYLE picker
--     (family_sku GG-JS-BOARD-GAME), the seven styles Amazon AU sells:
--     Green – Standard American 59 x 91 mm   50 and Value 150
--     Purple – Standard European 62 x 94 mm  Value 150
--     Ruby – Mini European 46 x 71 mm        50 and Value 150
--     Yellow – Mini American 44 x 67 mm      50 and Value 150
--
-- SKUs are Gamegenic's article numbers (GGX…ML) where a retailer listing
-- confirmed them; the rest are left to the shop_products SKU trigger (CP-…)
-- for an admin to replace with the number on the packaging. Barcodes are
-- only set where one was confirmed. The board-game styles are priced at the
-- Amazon AU price + 25% (their cost is recorded below); every other price is
-- a PLACEHOLDER (GST-inclusive AUD) to set before going live. Stock starts at
-- 0 and there are no photos yet — upload them through the product form so
-- the grid thumbnails are made.
--
-- Idempotent: a row is inserted only if no product already has its slug or
-- SKU, so a re-run adds nothing and never overwrites an admin's edits.

with v(sku, title, description, price_aud, category, slug, family_sku, colour, colour_hex, barcode) as (
  values
  -- ── Card game sizes ─────────────────────────────────────────────────────────
  ('GGX10001ML',
   'Gamegenic Just Sleeves Soft Sleeves - Clear (100)',
   'Gamegenic''s clear soft sleeves for standard-size trading cards (up to 64 x 90 mm). 100 sleeves per pack. The everyday penny sleeve: slide a card in straight from the pack, then into a top loader, card saver or binder. Acid-free and PVC-free.',
   3.95, 'Penny Sleeves', 'gamegenic-just-sleeves-soft-sleeves-clear-100', null, null, null, null),

  ('GGX10002ML',
   'Gamegenic Just Sleeves Inner Sleeves - Clear (100)',
   'Snug clear inner sleeves for double-sleeving standard-size cards. 100 sleeves per pack, each 64 x 89 mm. Fits Pokémon, Magic: The Gathering, Flesh and Blood and other standard cards before they go into an outer sleeve. Acid-free and PVC-free.',
   4.95, 'Perfect Fit Sleeves', 'gamegenic-just-sleeves-inner-sleeves-clear-100', null, null, null, null),

  (null,
   'Gamegenic Just Sleeves Standard Card Game (50) - Clear',
   'Gamegenic Just Sleeves for standard-size card games. 50 clear sleeves per pack, each 66 x 92 mm (for cards up to 64 x 90 mm). Clear on both sides with strong welded seams that resist split corners and shuffling wear. Acid-free and PVC-free.',
   4.95, 'Penny Sleeves', 'gamegenic-just-sleeves-standard-50-clear', 'GG-JS-STANDARD-50', 'Clear', null, null),

  ('GGX10004ML',
   'Gamegenic Just Sleeves Standard Card Game (50) - Black',
   'Gamegenic Just Sleeves for standard-size card games. 50 sleeves per pack, each 66 x 92 mm (for cards up to 64 x 90 mm). Clear front, fully opaque black back for tournament play, with strong welded seams that resist split corners and shuffling wear. Acid-free and PVC-free.',
   4.95, 'Penny Sleeves', 'gamegenic-just-sleeves-standard-50-black', 'GG-JS-STANDARD-50', 'Black', '#1B1B1D', null),

  ('GGX10006ML',
   'Gamegenic Just Sleeves Standard Card Game (50) - Green',
   'Gamegenic Just Sleeves for standard-size card games. 50 sleeves per pack, each 66 x 92 mm (for cards up to 64 x 90 mm). Clear front, fully opaque green back for tournament play, with strong welded seams that resist split corners and shuffling wear. Acid-free and PVC-free.',
   4.95, 'Penny Sleeves', 'gamegenic-just-sleeves-standard-50-green', 'GG-JS-STANDARD-50', 'Green', '#2E8B3E', null),

  ('GGX10007ML',
   'Gamegenic Just Sleeves Standard Card Game (50) - White',
   'Gamegenic Just Sleeves for standard-size card games. 50 sleeves per pack, each 66 x 92 mm (for cards up to 64 x 90 mm). Clear front, fully opaque white back for tournament play, with strong welded seams that resist split corners and shuffling wear. Acid-free and PVC-free.',
   4.95, 'Penny Sleeves', 'gamegenic-just-sleeves-standard-50-white', 'GG-JS-STANDARD-50', 'White', '#FFFFFF', null),

  ('GGX10008ML',
   'Gamegenic Just Sleeves Standard Card Game (50) - Blue',
   'Gamegenic Just Sleeves for standard-size card games. 50 sleeves per pack, each 66 x 92 mm (for cards up to 64 x 90 mm). Clear front, fully opaque blue back for tournament play, with strong welded seams that resist split corners and shuffling wear. Acid-free and PVC-free.',
   4.95, 'Penny Sleeves', 'gamegenic-just-sleeves-standard-50-blue', 'GG-JS-STANDARD-50', 'Blue', '#2E6FD9', null),

  ('GGX10010ML',
   'Gamegenic Just Sleeves Standard Value Pack - Clear (250)',
   'A value pack of 250 clear Gamegenic Just Sleeves for standard-size cards, each 66 x 92 mm (for cards up to 64 x 90 mm). Enough for several decks or a binder''s worth of pulls. Clear on both sides so card colours show unaltered, with strong welded seams against split corners and shuffling wear. Acid-free and PVC-free.',
   16.95, 'Penny Sleeves', 'gamegenic-just-sleeves-standard-value-pack-clear-250', null, null, null, '4251715411377'),

  ('GGX10011ML',
   'Gamegenic Just Sleeves Japanese Size (60) - Clear',
   'Gamegenic Just Sleeves in Japanese size for Yu-Gi-Oh!, Cardfight!! Vanguard and other smaller cards. 60 clear sleeves per pack, each 62 x 89 mm (for cards up to 60 x 87 mm). Acid-free and PVC-free.',
   4.95, 'Penny Sleeves', 'gamegenic-just-sleeves-japanese-60-clear', 'GG-JS-JAPANESE-60', 'Clear', null, null),

  (null,
   'Gamegenic Just Sleeves Japanese Size (60) - Black',
   'Gamegenic Just Sleeves in Japanese size for Yu-Gi-Oh!, Cardfight!! Vanguard and other smaller cards. 60 sleeves per pack, each 62 x 89 mm (for cards up to 60 x 87 mm), with a clear front and opaque black back. Acid-free and PVC-free.',
   4.95, 'Penny Sleeves', 'gamegenic-just-sleeves-japanese-60-black', 'GG-JS-JAPANESE-60', 'Black', '#1B1B1D', null),

  ('GGX10013ML',
   'Gamegenic Just Sleeves Japanese Size (60) - Red',
   'Gamegenic Just Sleeves in Japanese size for Yu-Gi-Oh!, Cardfight!! Vanguard and other smaller cards. 60 sleeves per pack, each 62 x 89 mm (for cards up to 60 x 87 mm), with a clear front and opaque red back. Acid-free and PVC-free.',
   4.95, 'Penny Sleeves', 'gamegenic-just-sleeves-japanese-60-red', 'GG-JS-JAPANESE-60', 'Red', '#C8202F', '4251715411407'),

  ('GGX10014ML',
   'Gamegenic Just Sleeves Japanese Size (60) - Green',
   'Gamegenic Just Sleeves in Japanese size for Yu-Gi-Oh!, Cardfight!! Vanguard and other smaller cards. 60 sleeves per pack, each 62 x 89 mm (for cards up to 60 x 87 mm), with a clear front and opaque green back. Acid-free and PVC-free.',
   4.95, 'Penny Sleeves', 'gamegenic-just-sleeves-japanese-60-green', 'GG-JS-JAPANESE-60', 'Green', '#2E8B3E', null),

  ('GGX10015ML',
   'Gamegenic Just Sleeves Japanese Size (60) - White',
   'Gamegenic Just Sleeves in Japanese size for Yu-Gi-Oh!, Cardfight!! Vanguard and other smaller cards. 60 sleeves per pack, each 62 x 89 mm (for cards up to 60 x 87 mm), with a clear front and opaque white back. Acid-free and PVC-free.',
   4.95, 'Penny Sleeves', 'gamegenic-just-sleeves-japanese-60-white', 'GG-JS-JAPANESE-60', 'White', '#FFFFFF', null),

  ('GGX10019ML',
   'Gamegenic Just Sleeves Japanese Size (60) - Pink',
   'Gamegenic Just Sleeves in Japanese size for Yu-Gi-Oh!, Cardfight!! Vanguard and other smaller cards. 60 sleeves per pack, each 62 x 89 mm (for cards up to 60 x 87 mm), with a clear front and opaque pink back. Acid-free and PVC-free.',
   4.95, 'Penny Sleeves', 'gamegenic-just-sleeves-japanese-60-pink', 'GG-JS-JAPANESE-60', 'Pink', '#E56BA3', null),

  -- ── Board game sizes: ONE line, seven styles ────────────────────────────────
  -- The Amazon AU "Just Sleeves Board Game" listing sells these as one product
  -- with a Style picker; here they are one colour family (GG-JS-BOARD-GAME),
  -- so the product page shows the same Style chips (utils/shopVariants.js
  -- isStyleName: "<colour code> – <size> <count>"). The colour code is
  -- Gamegenic's size code printed on the pack; its hex draws the chip dot.
  -- Price = the Amazon AU price on 2026-11-11 + 25%, rounded UP to 5c.
  ('GGX10020ML',
   'Gamegenic Just Sleeves Board Game — Green – Standard American 50',
   'Clear Gamegenic Just Sleeves for Standard American board game cards (size colour code green). 50 sleeves per pack, each 59 x 91 mm, for cards up to 57 x 89 mm. Strong welded seams resist split corners and shuffling wear. Acid-free and PVC-free.',
   8.15, 'Penny Sleeves', 'gamegenic-just-sleeves-board-game-green-standard-american-50', 'GG-JS-BOARD-GAME', 'Green – Standard American 50', '#2E8B3E', null),

  (null,
   'Gamegenic Just Sleeves Board Game — Green – Standard American Value 150',
   'A value pack of 150 clear Gamegenic Just Sleeves for Standard American board game cards (size colour code green), each 59 x 91 mm, for cards up to 57 x 89 mm. Strong welded seams resist split corners and shuffling wear. Acid-free and PVC-free.',
   14.25, 'Penny Sleeves', 'gamegenic-just-sleeves-board-game-green-standard-american-value-150', 'GG-JS-BOARD-GAME', 'Green – Standard American Value 150', '#2E8B3E', null),

  (null,
   'Gamegenic Just Sleeves Board Game — Purple – Standard European Value 150',
   'A value pack of 150 clear Gamegenic Just Sleeves for Standard European board game cards (size colour code purple), each 62 x 94 mm. Strong welded seams resist split corners and shuffling wear. Acid-free and PVC-free.',
   12.70, 'Penny Sleeves', 'gamegenic-just-sleeves-board-game-purple-standard-european-value-150', 'GG-JS-BOARD-GAME', 'Purple – Standard European Value 150', '#7A4FB5', null),

  ('GGX10023ML',
   'Gamegenic Just Sleeves Board Game — Ruby – Mini European 50',
   'Clear Gamegenic Just Sleeves for Mini European board game cards (size colour code ruby). 50 sleeves per pack, each 46 x 71 mm. Strong welded seams resist split corners and shuffling wear. Acid-free and PVC-free.',
   6.85, 'Penny Sleeves', 'gamegenic-just-sleeves-board-game-ruby-mini-european-50', 'GG-JS-BOARD-GAME', 'Ruby – Mini European 50', '#9B111E', null),

  (null,
   'Gamegenic Just Sleeves Board Game — Ruby – Mini European Value 150',
   'A value pack of 150 clear Gamegenic Just Sleeves for Mini European board game cards (size colour code ruby), each 46 x 71 mm. Strong welded seams resist split corners and shuffling wear. Acid-free and PVC-free.',
   14.15, 'Penny Sleeves', 'gamegenic-just-sleeves-board-game-ruby-mini-european-value-150', 'GG-JS-BOARD-GAME', 'Ruby – Mini European Value 150', '#9B111E', null),

  ('GGX10021ML',
   'Gamegenic Just Sleeves Board Game — Yellow – Mini American 50',
   'Clear Gamegenic Just Sleeves for Mini American board game cards (size colour code yellow). 50 sleeves per pack, each 44 x 67 mm. Strong welded seams resist split corners and shuffling wear. Acid-free and PVC-free.',
   7.05, 'Penny Sleeves', 'gamegenic-just-sleeves-board-game-yellow-mini-american-50', 'GG-JS-BOARD-GAME', 'Yellow – Mini American 50', '#E8B93B', null),

  (null,
   'Gamegenic Just Sleeves Board Game — Yellow – Mini American Value 150',
   'A value pack of 150 clear Gamegenic Just Sleeves for Mini American board game cards (size colour code yellow), each 44 x 67 mm. Strong welded seams resist split corners and shuffling wear. Acid-free and PVC-free.',
   11.20, 'Penny Sleeves', 'gamegenic-just-sleeves-board-game-yellow-mini-american-value-150', 'GG-JS-BOARD-GAME', 'Yellow – Mini American Value 150', '#E8B93B', null)
)
insert into public.shop_products (
  sku, title, description, price_aud, stock_quantity, product_type, category,
  brand, slug, status, family_sku, colour, colour_hex, barcode
)
select v.sku, v.title, v.description, v.price_aud, 0, 'accessory', v.category,
       'Gamegenic', v.slug, 'draft', v.family_sku, v.colour, v.colour_hex, v.barcode
from v
where not exists (select 1 from public.shop_products p where p.slug = v.slug)
  and (v.sku is null or not exists (
        select 1 from public.shop_products p where upper(p.sku) = upper(v.sku)));

-- ── Supplier link (admin-only) ────────────────────────────────────────────────
-- The Amazon listing the range was added from, so the weekly supplier price
-- watch follows it. Only fills a blank link; never overwrites one an admin set.
insert into public.shop_product_costs (product_id, supplier, supplier_sku, supplier_url, source)
select p.id, 'Amazon AU', 'B09JW8ZKHN', 'https://www.amazon.com.au/dp/B09JW8ZKHN', 'Amazon AU listing'
from public.shop_products p
where p.slug = 'gamegenic-just-sleeves-standard-value-pack-clear-250'
on conflict (product_id) do update
  set supplier_url = coalesce(public.shop_product_costs.supplier_url, excluded.supplier_url),
      supplier = coalesce(public.shop_product_costs.supplier, excluded.supplier),
      supplier_sku = coalesce(public.shop_product_costs.supplier_sku, excluded.supplier_sku);

-- ── Board game styles: Amazon AU cost + supplier link (admin-only) ──────────
-- Cost = the Amazon AU price (GST-inclusive) on 2026-11-11, so Admin → Products
-- shows the 25% margin. Each style's own listing (ASIN) is the supplier link the
-- weekly price watch reads; Green – Standard American 50 had no ASIN to hand,
-- so its link is left for an admin to paste in. Only blanks are filled.
with c(slug, cost_inc, asin) as (
  values
  ('gamegenic-just-sleeves-board-game-green-standard-american-50',          6.50, null),
  ('gamegenic-just-sleeves-board-game-green-standard-american-value-150',  11.40, 'B0G354CJM9'),
  ('gamegenic-just-sleeves-board-game-purple-standard-european-value-150', 10.13, 'B0G357SLJ3'),
  ('gamegenic-just-sleeves-board-game-ruby-mini-european-50',               5.48, 'B0G353YZZX'),
  ('gamegenic-just-sleeves-board-game-ruby-mini-european-value-150',       11.31, 'B0G358DDV5'),
  ('gamegenic-just-sleeves-board-game-yellow-mini-american-50',             5.64, 'B0G355G6CF'),
  ('gamegenic-just-sleeves-board-game-yellow-mini-american-value-150',      8.95, 'B0G3549FGG')
)
insert into public.shop_product_costs (
  product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier, supplier_sku, supplier_url, source
)
select p.id, round(c.cost_inc / 1.1, 2), c.cost_inc, 'Amazon AU', c.asin,
       case when c.asin is not null then 'https://www.amazon.com.au/dp/' || c.asin end,
       'Amazon AU listing, 2026-11-11'
from c
join public.shop_products p on p.slug = c.slug
on conflict (product_id) do update
  set wholesale_ex_gst_aud = coalesce(public.shop_product_costs.wholesale_ex_gst_aud, excluded.wholesale_ex_gst_aud),
      wholesale_inc_gst_aud = coalesce(public.shop_product_costs.wholesale_inc_gst_aud, excluded.wholesale_inc_gst_aud),
      supplier = coalesce(public.shop_product_costs.supplier, excluded.supplier),
      supplier_sku = coalesce(public.shop_product_costs.supplier_sku, excluded.supplier_sku),
      supplier_url = coalesce(public.shop_product_costs.supplier_url, excluded.supplier_url),
      source = coalesce(public.shop_product_costs.source, excluded.source);
