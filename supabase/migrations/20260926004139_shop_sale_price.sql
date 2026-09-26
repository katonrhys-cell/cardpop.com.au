-- Optional sale price for shop products and their colour variants.
--
-- price_aud stays the regular selling price (normally the RRP). When
-- sale_price_aud is set, above zero and below the regular price, the shopper
-- pays the sale price and the storefront shows a SALE badge with the higher of
-- the RRP / regular price struck through. Clearing it puts the item back to
-- its regular price. The rule lives in utils/shopPricing.js, which both the
-- storefront and the server cart (src/services/cartService.js) use.
--
-- A variant with its own price_aud uses its own sale_price_aud; a variant that
-- inherits the product price inherits the product's sale price too.
--
-- Backward-compatible: nullable columns, no data change, so nothing goes on
-- sale until an admin enters a sale price. Idempotent.

alter table public.shop_products
  add column if not exists sale_price_aud numeric(10,2);

alter table public.shop_product_variants
  add column if not exists sale_price_aud numeric(10,2);

alter table public.shop_products
  drop constraint if exists shop_products_sale_price_aud_check;
alter table public.shop_products
  add constraint shop_products_sale_price_aud_check
  check (sale_price_aud is null or sale_price_aud >= 0);

alter table public.shop_product_variants
  drop constraint if exists shop_product_variants_sale_price_aud_check;
alter table public.shop_product_variants
  add constraint shop_product_variants_sale_price_aud_check
  check (sale_price_aud is null or sale_price_aud >= 0);

comment on column public.shop_products.sale_price_aud is
  'Optional sale price (AUD, GST-inclusive). Applies only when > 0 and below price_aud; null = not on sale. See utils/shopPricing.js.';
comment on column public.shop_product_variants.sale_price_aud is
  'Optional sale price for this colour. Used with the variant''s own price_aud; a variant with null price_aud inherits the product sale price.';
