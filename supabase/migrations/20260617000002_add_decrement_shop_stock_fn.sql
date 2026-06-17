-- Atomic stock decrement for shop products, called from the Stripe webhook
-- when a cart order is confirmed. Applied to production 2026-06-17.

create or replace function public.decrement_shop_stock(p_id uuid, p_qty integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.shop_products
  set stock_quantity = greatest(0, stock_quantity - p_qty),
      updated_at = now()
  where id = p_id;
$$;
