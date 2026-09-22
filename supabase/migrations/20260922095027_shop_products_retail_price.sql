-- Bring shop_products.retail_price_aud (the RRP) under migration control.
--
-- The column already exists in production but no repo migration ever added it
-- (it was created outside the repo), so a fresh environment built from the
-- migrations alone lacks it and every shop page that selects it would 500.
-- This is idempotent: `add column if not exists` is a no-op in production and
-- creates the column everywhere else. The check constraint is added
-- conditionally for the same reason.
--
-- Semantics: retail_price_aud is the manufacturer's RRP shown struck-through
-- (or as "RRP $X" on an unpriced draft). price_aud stays the selling price.
-- Populate it with scripts/apply-shop-rrp.mjs from data/shop-rrp.csv or via
-- Admin → Products → edit — see docs/shop-rrp.md.

alter table public.shop_products
  add column if not exists retail_price_aud numeric(10,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shop_products_retail_price_aud_check'
      and conrelid = 'public.shop_products'::regclass
  ) then
    alter table public.shop_products
      add constraint shop_products_retail_price_aud_check
      check (retail_price_aud is null or retail_price_aud >= 0);
  end if;
end $$;

comment on column public.shop_products.retail_price_aud is
  'Manufacturer RRP in AUD. Shown struck-through when higher than price_aud; price_aud is the selling price.';
