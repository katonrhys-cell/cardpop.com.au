-- Add a `coming_soon` status to shop products.
--
-- A product marked coming soon is publicly visible (grids, product pages,
-- sitemap) but cannot be bought: the storefront shows a "Coming soon" button
-- that opens the enquiry form, and every checkout path already requires
-- status = 'active' (src/services/cartService.js, src/routes/stripe.js), so
-- nothing changes on the money side.
--
-- Two schema pieces:
--   1. Widen the status check constraint (active | draft | archived | coming_soon).
--   2. Let anonymous readers see coming_soon rows — the public half of the
--      consolidated SELECT policy was `status = 'active'`.
--
-- Idempotent: the constraint and policy are dropped by name and re-created.

alter table public.shop_products
  drop constraint if exists shop_products_status_check;

alter table public.shop_products
  add constraint shop_products_status_check
  check (status in ('active', 'draft', 'archived', 'coming_soon'));

-- The SELECT policy was consolidated into one permissive policy on
-- 2026-07-19 (admins see every row, the public sees active). Recreate it with
-- coming_soon added to the public half; the original name is dropped too in
-- case an environment still carries it.
drop policy if exists "shop_products_public_read_active" on public.shop_products;
drop policy if exists "shop_products_select_access" on public.shop_products;
create policy "shop_products_select_access" on public.shop_products as permissive for select to public
  using (
    (exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    ))
    or status in ('active', 'coming_soon')
  );

comment on column public.shop_products.status is
  'active = on sale; coming_soon = shown publicly with an enquiry button, not purchasable; draft = hidden; archived = retired.';
