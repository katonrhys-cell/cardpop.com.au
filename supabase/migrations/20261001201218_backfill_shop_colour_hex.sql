-- Swatch colours for the shop colours that were imported without one.
--
-- White, Jade, Green, Orange and Rose rows (shop_products colour siblings and
-- any shop_product_variants) had colour_hex NULL, so their picker chips drew
-- no dot. Values match the frontend palette in utils/colourSwatch.js, which
-- already holds the hexes the other colours carry. Clear is left NULL on
-- purpose: it has no colour of its own and is drawn as a see-through pattern.
--
-- Idempotent: only fills rows that still have no hex, so an admin-chosen
-- colour is never overwritten.

with palette(colour, hex) as (
  values
    ('white',  '#FFFFFF'),
    ('jade',   '#00A86B'),
    ('green',  '#2E8B3E'),
    ('orange', '#EE7A1F'),
    ('rose',   '#E8A2B0')
)
update public.shop_products p
set colour_hex = palette.hex
from palette
where lower(trim(p.colour)) = palette.colour
  and nullif(trim(p.colour_hex), '') is null;

with palette(colour, hex) as (
  values
    ('white',  '#FFFFFF'),
    ('jade',   '#00A86B'),
    ('green',  '#2E8B3E'),
    ('orange', '#EE7A1F'),
    ('rose',   '#E8A2B0')
)
update public.shop_product_variants v
set colour_hex = palette.hex
from palette
where lower(trim(v.colour)) = palette.colour
  and nullif(trim(v.colour_hex), '') is null;
