-- Add a "was"/RRP price to shop affiliate products so the shop can show a sale
-- price alongside the recommended retail price with an automatic "% off" badge.
--
-- `price_label`          — the current / sale price (bold on the card).
-- `original_price_label` — the RRP, rendered struck-through and prefixed "RRP".
--
-- The "% off" badge is derived at render time by parsing the numeric portion of
-- both labels, so nothing extra is stored. Both remain free text so values like
-- "From $19" still work (the badge simply doesn't render when a value can't be
-- parsed or the RRP isn't higher than the sale price).

ALTER TABLE shop_affiliate_products
  ADD COLUMN IF NOT EXISTS original_price_label text;
