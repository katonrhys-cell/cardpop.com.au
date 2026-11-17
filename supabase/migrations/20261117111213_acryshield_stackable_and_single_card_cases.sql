-- Acryshield range: the eleven products the shop was missing, and three marked
-- sold out.
--
-- The Palms Off Gaming wholesale range lists nineteen Acryshield cases. Eight
-- were already in the shop (20261003010203_acryshield_cases_preorder.sql). This
-- adds the other eleven:
--
--   * Pokémon Booster Box Stackable Acrylic Case, five base colours
--     (AS-STK-01 … 05), RRP $54.99
--   * Pokémon Elite Trainer Box Stackable Acrylic Case, five base colours
--     (AS-STK-06 … 10), RRP $59.99
--   * Single Card Acrylic Display Case with Stand (CDC-01), RRP $15.95
--
-- Each stackable colour is its own product, linked into one colour family by
-- family_sku (AS-STK-BB / AS-STK-ETB), so the five share a page and show as
-- colour chips: /shop/display-cases/<line-slug>?colour=<colour>. The colour is
-- the colour of the base panel; the case itself is clear. colour_hex is left
-- null so the swatch comes from the colour name (utils/colourSwatch.js), which
-- also draws "Clear" as see-through.
--
-- SKUs are the supplier's own. Priced at the manufacturer RRP like the rest of
-- the range (price_aud = retail_price_aud), GST-inclusive. The wholesale cost
-- goes in the admin-only shop_product_costs table, never on shop_products.
--
-- The stackable cases are pre-orders with the range's estimate, "Ships in 5–7
-- days" (pre-orders are unlimited, so stock stays 0 — docs/shop-preorders.md).
--
-- Sold out at the supplier on 17 November 2026, so not offered as pre-orders:
-- the 151 Mew Ultra Premium Collection case, the Japanese Collection Box case
-- and the Single Card Display Case. A sold-out shop product is status 'active'
-- with stock 0 (utils/shopStock.js): it stays on the site with a Sold out label
-- and an Enquire button. When stock is available again, set it back to
-- Pre-order (or Active with a stock count) in Admin → Products.
--
-- Photos are the supplier's, resized and served from
-- public/images/shop/acryshield/. The three detail shots (stacked cases, base,
-- lid) are shared by all ten stackable cases.
--
-- Copy sticks to what the supplier states and the photos show: clear acrylic,
-- a coloured base, made to stack, the product eras each case is made for, and
-- that case sizes vary slightly. No dimensions are claimed.
--
-- Data-only and idempotent: a product is only inserted when its SKU doesn't
-- exist yet and a cost row only when the product has none; the sold-out change
-- only touches a row still on pre-order, and a cost is only updated while it
-- still holds the figure the earlier migration seeded. A re-run, or an admin's
-- later edit, is left alone.

-- 1. Stackable cases: two lines × five base colours.
with lines(line, family_sku, title, slug, img, fits, made_for, rrp, cost_ex, cost_inc) as (
  values
    ('BB', 'AS-STK-BB',
     'Acryshield Pokémon Booster Box Stackable Acrylic Case',
     'acryshield-pokemon-booster-box-stackable-acrylic-case', 'booster-box',
     'a standard English Pokémon TCG booster box',
     'Pokémon TCG booster boxes from Base Set through to the Scarlet & Violet era',
     54.99, 27.18, 29.90),
    ('ETB', 'AS-STK-ETB',
     'Acryshield Pokémon Elite Trainer Box Stackable Acrylic Case',
     'acryshield-pokemon-elite-trainer-box-stackable-acrylic-case', 'etb',
     'a standard English Pokémon TCG Elite Trainer Box',
     'Pokémon TCG Elite Trainer Boxes from the Black & White era through to Scarlet & Violet',
     59.99, 32.18, 35.40)
),
skus(line, colour, sku) as (
  values
    ('BB', 'Clear', 'AS-STK-01'), ('BB', 'Red', 'AS-STK-02'), ('BB', 'Blue', 'AS-STK-03'),
    ('BB', 'Green', 'AS-STK-04'), ('BB', 'Yellow', 'AS-STK-05'),
    ('ETB', 'Clear', 'AS-STK-06'), ('ETB', 'Red', 'AS-STK-07'), ('ETB', 'Blue', 'AS-STK-08'),
    ('ETB', 'Green', 'AS-STK-09'), ('ETB', 'Yellow', 'AS-STK-10')
),
items as (
  select s.sku, s.colour, l.*
  from skus s
  join lines l on l.line = s.line
),
inserted as (
  insert into public.shop_products (
    sku, title, description, price_aud, retail_price_aud, stock_quantity, product_type,
    category, brand, status, preorder_eta, slug, images, image_url,
    family_sku, colour
  )
  select
    i.sku,
    i.title || ' — ' || i.colour,
    'An Acryshield stackable acrylic display case with a ' || lower(i.colour) || ' base, made to fit ' || i.fits
      || '. It keeps sealed product free of dust, dents and handling marks while leaving it on full view.'
      || E'\n\n' ||
    case when i.colour = 'Clear' then
      $clear$The case is clear acrylic on every side, base included, so nothing competes with the box art.$clear$
    else
      'The case is clear acrylic on every side, with a ' || lower(i.colour)
        || ' base panel that shows as a line of colour under the box.'
    end
      || ' ' ||
    $stack$Cases in this range are made to stack: one sits on top of another, so a run of sealed boxes can go up a shelf as well as along it. The base comes in clear, red, blue, green and yellow, so you can match a set's colours or mix them down a stack.$stack$
      || E'\n\n' ||
    'Acryshield make this case for ' || i.made_for
      || $fit$ and later. Check the fit before you order: boxes from other regions, older print runs and special editions can be a different size, and the maker allows for slight variation in the size of each case.$fit$
      || E'\n\n' ||
    $p$Pre-order: you pay now and we dispatch as soon as stock lands with us, usually within 5–7 days. Each case is sold individually. The product shown inside the case in the photos is a display sample and is not included.$p$,
    i.rrp,
    i.rrp,
    0,
    'accessory',
    'Display Cases',
    'Acryshield',
    'preorder',
    'Ships in 5–7 days',
    i.slug || '-' || lower(i.colour),
    (
      select jsonb_agg('https://cardpop.com.au/images/shop/acryshield/stackable/' || f || '.jpg' order by o)
      from unnest(array[
        i.img || '-' || lower(i.colour) || '-1',
        i.img || '-' || lower(i.colour) || '-2',
        i.img || '-' || lower(i.colour) || '-3',
        i.img || '-' || lower(i.colour) || '-4',
        'stackable-stacked', 'stackable-base', 'stackable-lid'
      ]) with ordinality as u(f, o)
    ),
    'https://cardpop.com.au/images/shop/acryshield/stackable/' || i.img || '-' || lower(i.colour) || '-1.jpg',
    i.family_sku,
    i.colour
  from items i
  where not exists (
    select 1 from public.shop_products x where upper(x.sku) = upper(i.sku)
  )
  returning id, sku
)
insert into public.shop_product_costs (
  product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier, supplier_sku, source
)
select p.id, i.cost_ex, i.cost_inc, 'Palms Off Gaming', i.sku,
       'Palms Off Gaming wholesale price list (17 NOV 2026)'
from inserted p
join items i on i.sku = p.sku
on conflict (product_id) do nothing;

-- 2. Single Card Acrylic Display Case with Stand — sold out at the supplier, so
--    it goes in as Active with no stock (Sold out + Enquire), not a pre-order.
with inserted as (
  insert into public.shop_products (
    sku, title, description, price_aud, retail_price_aud, stock_quantity, product_type,
    category, brand, status, slug, images, image_url
  )
  select
    'CDC-01',
    'Acryshield Single Card Acrylic Display Case with Stand',
    $s1$An Acryshield clear acrylic display case for a single trading card, supplied with its own acrylic stand. It shows off one favourite card on a shelf or desk while keeping fingers and dust off it.$s1$
      || E'\n\n' ||
    $s2$The card sits between two panels of clear acrylic held together at the four corners, so the whole card stays in view from the front and the back. The case stands upright in a slotted clear acrylic base, which keeps the card facing out without leaning it against anything.$s2$
      || E'\n\n' ||
    $s3$The maker allows for slight variation in the size of each case. The card shown in the photos is a display sample and is not included.$s3$,
    15.95,
    15.95,
    0,
    'accessory',
    'Display Cases',
    'Acryshield',
    'active',
    'acryshield-single-card-acrylic-display-case-with-stand',
    jsonb_build_array(
      'https://cardpop.com.au/images/shop/acryshield/single-card-case-1.jpg',
      'https://cardpop.com.au/images/shop/acryshield/single-card-case-2.jpg',
      'https://cardpop.com.au/images/shop/acryshield/single-card-case-3.jpg'
    ),
    'https://cardpop.com.au/images/shop/acryshield/single-card-case-1.jpg'
  where not exists (
    select 1 from public.shop_products x where upper(x.sku) = 'CDC-01'
  )
  returning id
)
insert into public.shop_product_costs (
  product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier, supplier_sku, source
)
select p.id, 9.00, 9.90, 'Palms Off Gaming', 'CDC-01',
       'Palms Off Gaming wholesale price list (17 NOV 2026)'
from inserted p
on conflict (product_id) do nothing;

-- 3. Mark the Mew Ultra Premium Collection case and the Japanese Collection Box
--    case sold out: off pre-order, Active with no stock. The pre-order sentence
--    comes out of the description; the "display sample" sentence after it stays.
--    preorder_eta is kept so switching back to Pre-order needs no retyping (it
--    is only shown while the status is 'preorder').
update public.shop_products
set status = 'active',
    stock_quantity = 0,
    description = replace(
      description,
      $old$Pre-order: you pay now and we dispatch as soon as stock lands with us, usually within 5–7 days. $old$,
      ''
    )
where upper(sku) in ('ACRYSHIELD-MEW-UPC', 'ACRYSHIELD-JPN-COLLECTION')
  and status = 'preorder';

-- 4. Supplier costs for the cases already in the shop. The wholesale price list
--    has moved by a few cents since October, and it now gives the supplier's
--    SKUs (the shop's own ACRYSHIELD-… SKUs are left as they are). A cost is
--    only replaced while it still holds the October figure.
with current_list(sku, supplier_sku, old_ex, cost_ex, cost_inc) as (
  values
    ('ACRYSHIELD-ETB',             'MC-AS-ETB-P',   24.25, 24.30, 26.73),
    ('ACRYSHIELD-BOOSTER-BOX',     'MC-AS-BB-P',    19.50, 19.50, 21.45),
    ('ACRYSHIELD-JPN-STANDARD',    'MC-AS-BB-JPMS', 18.12, 18.10, 19.91),
    ('ACRYSHIELD-MEW-UPC',         'BOX-UPC-151',   42.34, 42.40, 46.64),
    ('ACRYSHIELD-JPN-HIGH-CLASS',  'MC-AS-JBB-HC',  15.04, 15.00, 16.50),
    ('ACRYSHIELD-PRE-SPC',         'PE-SPC',        42.34, 42.40, 46.64),
    ('ACRYSHIELD-JPN-COLLECTION',  'BOX-JPN-COL',   26.56, 26.60, 29.26),
    ('ACRYSHIELD-WOTC-THEME-DECK', 'BOX-TD-WOTC',   15.97, 16.00, 17.60)
)
update public.shop_product_costs c
set wholesale_ex_gst_aud = l.cost_ex,
    wholesale_inc_gst_aud = l.cost_inc,
    supplier_sku = coalesce(nullif(btrim(c.supplier_sku), ''), l.supplier_sku),
    source = 'Palms Off Gaming wholesale price list (17 NOV 2026)',
    updated_at = now()
from current_list l
join public.shop_products p on upper(p.sku) = l.sku
where c.product_id = p.id
  and c.wholesale_ex_gst_aud = l.old_ex;
