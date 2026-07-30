-- CardPop Shop pricing: GST-inclusive prices + flat shipping.
--
-- 1. Shop items are now quoted GST-inclusive (the advertised $12.99 IS the
--    total including GST), so the GST is a component already inside the price
--    rather than an amount added on top at checkout. The order keeps two GST
--    figures: gst_aud (GST *added* on top — marketplace listings) and the new
--    gst_included_aud (GST already *inside* the shop price + shipping), so a
--    receipt can show an accurate "includes GST" line without double-counting.
--
-- 2. Flat domestic shipping on CardPop Shop items: $10 per order, free once the
--    shop-item subtotal reaches $50. These live in platform_settings and stay
--    editable from Admin → Platform Settings → Listings.
--
-- Backward-compatible: the new column is nullable with a 0 default, so existing
-- checkout inserts that omit it keep working unchanged.

alter table public.orders
  add column if not exists gst_included_aud numeric not null default 0;

comment on column public.orders.gst_included_aud is
  'GST already included in GST-inclusive prices (CardPop Shop items + shipping). '
  'Distinct from gst_aud, which is GST added on top of the item price for '
  'marketplace listings. Shown as an "includes GST" line on receipts.';

-- Shipping: $10 flat, free over $50. Seeded so the values are visible and
-- editable in Admin → Platform Settings; cartService already falls back to the
-- same 10/50 defaults, so the rows are configuration surface, not behaviour.
--
-- Applies whether or not the rows already exist. This deliberately does NOT use
-- `on conflict (key) do update ... set updated_at = now()`: platform_settings
-- predates migration tracking, so no migration in this repo defines its columns
-- or constraints, and the ON CONFLICT form failed against production — which is
-- what both a missing unique index on `key` and a missing `updated_at` column
-- look like. Because this migration sorts first among the pending ones, that
-- failure blocked every later migration from applying. Update-then-insert needs
-- neither a unique constraint nor updated_at, and is equally idempotent.
update public.platform_settings
   set value = '10'::jsonb
 where key = 'default_shipping_rate_aud';

insert into public.platform_settings (key, value)
select 'default_shipping_rate_aud', '10'::jsonb
 where not exists (
   select 1 from public.platform_settings where key = 'default_shipping_rate_aud'
 );

update public.platform_settings
   set value = '50'::jsonb
 where key = 'free_shipping_threshold_aud';

insert into public.platform_settings (key, value)
select 'free_shipping_threshold_aud', '50'::jsonb
 where not exists (
   select 1 from public.platform_settings where key = 'free_shipping_threshold_aud'
 );
