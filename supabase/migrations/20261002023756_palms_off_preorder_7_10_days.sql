-- Put the Palms Off Gaming range on pre-order, shipping in 7–10 days.
--
-- The wholesale range is held by the supplier, not CardPop, so every visible
-- line was `coming_soon` (enquiry only, 0 stock). As a pre-order it can be
-- bought now: pre-orders are unlimited (stock is ignored), and the buyer sees
-- "Ships in 7–10 days" on the product, in the cart, at checkout, on the
-- receipt and in their order history.
--
-- 1. Give every Palms Off line the estimate, unless an admin already set one —
--    archived lines too, so it's there if one is brought back.
-- 2. Switch `coming_soon` lines that have a real price to `preorder`. A line
--    with no price stays as it is (it couldn't be bought anyway), and
--    `active`, `draft` and `archived` lines are left alone.
--
-- Depends on 20261002000345_shop_products_preorder_status.sql (status value +
-- column + the check that a pre-order has an estimate). Idempotent: re-running
-- touches nothing an earlier run, or an admin, has already set.

update public.shop_products
set preorder_eta = 'Ships in 7–10 days', updated_at = now()
where brand = 'Palms Off Gaming'
  and nullif(btrim(coalesce(preorder_eta, '')), '') is null;

update public.shop_products
set status = 'preorder', updated_at = now()
where brand = 'Palms Off Gaming'
  and status = 'coming_soon'
  and price_aud > 0;
