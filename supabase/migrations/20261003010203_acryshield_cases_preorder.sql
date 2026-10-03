-- Acryshield acrylic display cases (distributed by Palms Off Gaming) on
-- pre-order, estimate "Ships in 5–7 days".
--
-- Nine products from the Palms Off Gaming "All Acryshield" range: eight cases
-- for sealed Pokémon product and a graded-slab stand. Each is its own product
-- (no colour family). Cases go in Display Cases, the stand in Acrylic Stands,
-- so pages land at /shop/display-cases/<slug> and /shop/acrylic-stands/<slug>.
--
-- Priced at the manufacturer RRP, like the rest of the Palms Off range
-- (price_aud = retail_price_aud), GST-inclusive. The wholesale cost from the
-- Palms Off trade price list (October 2026) goes in the admin-only
-- shop_product_costs table, never on shop_products, which is publicly readable.
--
-- Pre-orders are unlimited (stock is ignored), so stock_quantity stays 0 until
-- the order from Palms Off lands. Then set stock and switch to Active
-- (docs/shop-preorders.md).
--
-- SKUs: CardPop placeholders (ACRYSHIELD-…) until Palms Off's own SKUs are
-- confirmed. Change one in Admin → Products; nothing else keys on it.
--
-- Photos: interim, cropped from the supplier's product listing and served from
-- public/images/shop/acryshield/. Replace them with the supplier's full-size
-- images in Admin → Products when they're available.
--
-- Copy sticks to what the supplier states: the packaging lists crystal-clear
-- thick acrylic, a strong magnetic closure, acid-free / no PVC and UV
-- resistance. Sizes beyond "made to fit <product>" aren't claimed.
--
-- Data-only and idempotent: a product is only inserted when its SKU doesn't
-- exist yet, and a cost row only when the product has none, so a re-run (or an
-- admin's later edits) is left alone.

with items(sku, slug, title, category, fits, rrp, cost_ex, cost_inc, imgs) as (
  values
    ('ACRYSHIELD-PSA-STAND', 'acryshield-psa-graded-card-acrylic-stand',
     'Acryshield PSA Graded Card Acrylic Stand', 'Acrylic Stands',
     'a PSA graded slab', 7.95, 4.00, 4.40, array['psa-stand']),
    ('ACRYSHIELD-PRE-SPC', 'acryshield-prismatic-evolutions-super-premium-collection-acrylic-case',
     'Acryshield Prismatic Evolutions Super-Premium Collection Acrylic Case', 'Display Cases',
     'the Pokémon TCG Prismatic Evolutions Super-Premium Collection', 75.00, 42.34, 46.57, array['prismatic-spc']),
    ('ACRYSHIELD-JPN-COLLECTION', 'acryshield-japanese-collection-box-acrylic-case',
     'Acryshield Japanese Collection Box Acrylic Case', 'Display Cases',
     'a Japanese Pokémon Center collection box, such as the special boxes', 49.95, 26.56, 29.22, array['japanese-collection-box']),
    ('ACRYSHIELD-WOTC-THEME-DECK', 'acryshield-wotc-theme-deck-display-acrylic-case',
     'Acryshield WOTC Theme Deck Display Acrylic Case', 'Display Cases',
     'a sealed Wizards of the Coast Pokémon theme deck (1999–2002)', 29.95, 15.97, 17.57, array['wotc-theme-deck_pkg', 'wotc-theme-deck']),
    ('ACRYSHIELD-MEW-UPC', 'acryshield-mew-ultra-premium-collection-acrylic-case',
     'Acryshield Mew Ultra Premium Collection Acrylic Case', 'Display Cases',
     'the Pokémon TCG Scarlet & Violet 151 Ultra-Premium Collection (Mew)', 75.00, 42.34, 46.57, array['mew-upc']),
    ('ACRYSHIELD-ETB', 'acryshield-pokemon-elite-trainer-box-acrylic-case',
     'Acryshield Pokémon Elite Trainer Box Acrylic Case', 'Display Cases',
     'a standard English Pokémon TCG Elite Trainer Box', 49.95, 24.25, 26.68, array['etb']),
    ('ACRYSHIELD-BOOSTER-BOX', 'acryshield-pokemon-booster-box-acrylic-case',
     'Acryshield Pokémon Booster Box Acrylic Case', 'Display Cases',
     'a standard English 36-pack Pokémon TCG booster box', 44.95, 19.50, 21.45, array['booster-box']),
    ('ACRYSHIELD-JPN-HIGH-CLASS', 'acryshield-japanese-high-class-booster-box-acrylic-case',
     'Acryshield Japanese High Class Booster Box Acrylic Case', 'Display Cases',
     'a Japanese Pokémon high class booster box, such as VSTAR Universe', 29.95, 15.04, 16.54, array['japanese-high-class']),
    ('ACRYSHIELD-JPN-STANDARD', 'acryshield-japanese-standard-booster-box-acrylic-case',
     'Acryshield Japanese Standard Booster Box Acrylic Case', 'Display Cases',
     'a standard Japanese Pokémon booster box, such as Pokémon Card 151', 32.50, 18.12, 19.93, array['japanese-standard'])
),
inserted as (
  insert into public.shop_products (
    sku, title, description, price_aud, retail_price_aud, stock_quantity, product_type,
    category, brand, status, preorder_eta, slug, images, image_url
  )
  select
    i.sku,
    i.title,
    case when i.category = 'Acrylic Stands' then
      $s1$A clear acrylic stand from Acryshield that holds a PSA graded slab upright, so it can sit on a shelf, desk or card-show table with the label and card facing out.$s1$
        || E'\n\n' ||
      $s2$The slab slots into a clear acrylic base that keeps it standing upright, with nothing clamping down on the case. The clear acrylic keeps attention on the card, and the stand is small enough to line several slabs up along a shelf.$s2$
    else
      'An Acryshield acrylic display case made to fit ' || i.fits || '. It keeps sealed product free of dust, dents and handling marks while leaving it on full view.'
        || E'\n\n' ||
      $c2$Acryshield cases are made from thick, crystal-clear acrylic with a strong magnetic lid, so the box slides in and the lid closes flush with no screws or clips. The acrylic is acid-free with no PVC, so it won't react with the packaging over time, and it is UV resistant to help slow fading on a shelf that catches daylight. Corners and edges take the knocks instead of the box inside, which is where sealed product usually picks up its first damage.$c2$
        || E'\n\n' ||
      $c3$Check the fit before you order: boxes from other regions, older print runs and special editions can be a different size from the one named above.$c3$
    end
      || E'\n\n' ||
    $p$Pre-order: you pay now and we dispatch as soon as stock lands with us, usually within 5–7 days. The product shown inside the case in the photos is a display sample and is not included.$p$,
    i.rrp,
    i.rrp,
    0,
    'accessory',
    i.category,
    'Acryshield',
    'preorder',
    'Ships in 5–7 days',
    i.slug,
    (select jsonb_agg('https://cardpop.com.au/images/shop/acryshield/' || f || '.jpg' order by o)
       from unnest(i.imgs) with ordinality as u(f, o)),
    'https://cardpop.com.au/images/shop/acryshield/' || i.imgs[1] || '.jpg'
  from items i
  where not exists (
    select 1 from public.shop_products x where upper(x.sku) = upper(i.sku)
  )
  returning id, sku
)
insert into public.shop_product_costs (product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier, source)
select p.id, i.cost_ex, i.cost_inc, 'Palms Off Gaming', 'Palms Off Gaming trade price list (OCT 2026)'
from inserted p
join items i on i.sku = p.sku
on conflict (product_id) do nothing;
