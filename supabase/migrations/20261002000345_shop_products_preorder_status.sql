-- Pre-orders for shop products.
--
-- A product marked `preorder` is publicly visible AND purchasable, exactly like
-- `active`, but the storefront labels it "Pre-order" and shows the admin's
-- estimated dispatch (`preorder_eta`, free text such as "Ships in 4–6 weeks"
-- or "Expected mid-November"). The buyer pays in full at checkout; cartService
-- stamps `preorder: true` + the ETA onto the order line so the receipt, the
-- buyer's order history and Admin → Order Management all say it is a pre-order.
--
-- Stock works as the pre-order allocation: stock_quantity is how many units are
-- available to pre-order (e.g. what was ordered from the supplier). Checkout
-- decrements it as usual, so pre-orders can never exceed the allocation, and
-- at 0 the product shows "Sold out" with the enquiry button.
--
-- When stock arrives the admin flips the product to `active`.
--
-- Schema pieces:
--   1. Widen the status check constraint (+ preorder).
--   2. preorder_eta column, required (non-blank) while status = 'preorder'.
--   3. Let anonymous readers see preorder rows (products + their variants).
--
-- Idempotent: constraints and policies are dropped by name and re-created.

alter table public.shop_products
  add column if not exists preorder_eta text;

comment on column public.shop_products.preorder_eta is
  'Estimated dispatch shown to buyers while status = preorder, e.g. "Ships in 4–6 weeks". Snapshotted onto each order line at checkout.';

alter table public.shop_products
  drop constraint if exists shop_products_status_check;

alter table public.shop_products
  add constraint shop_products_status_check
  check (status in ('active', 'preorder', 'draft', 'archived', 'coming_soon'));

-- A pre-order with no stated dispatch estimate is exactly what this feature
-- exists to prevent, so the database refuses it whichever writer tries.
alter table public.shop_products
  drop constraint if exists shop_products_preorder_eta_required;

alter table public.shop_products
  add constraint shop_products_preorder_eta_required
  check (status <> 'preorder' or nullif(btrim(coalesce(preorder_eta, '')), '') is not null);

alter table public.shop_products
  drop constraint if exists shop_products_preorder_eta_length;

alter table public.shop_products
  add constraint shop_products_preorder_eta_length
  check (preorder_eta is null or char_length(preorder_eta) <= 120);

-- Public read: active, preorder and coming_soon (admins see every row).
drop policy if exists "shop_products_public_read_active" on public.shop_products;
drop policy if exists "shop_products_select_access" on public.shop_products;
create policy "shop_products_select_access" on public.shop_products as permissive for select to public
  using (
    (exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    ))
    or status in ('active', 'preorder', 'coming_soon')
  );

-- Variants of a pre-order product must be readable too, or the colour picker
-- (and the cart's per-variant checkout) would vanish for the public.
drop policy if exists "shop_product_variants_select" on public.shop_product_variants;
create policy "shop_product_variants_select" on public.shop_product_variants for select to public
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    or exists (select 1 from public.shop_products sp where sp.id = product_id and sp.status in ('active', 'preorder', 'coming_soon'))
  );

comment on column public.shop_products.status is
  'active = on sale; preorder = on sale before stock arrives (shows preorder_eta, stock_quantity is the pre-order allocation); coming_soon = shown publicly with an enquiry button, not purchasable; draft = hidden; archived = retired.';
