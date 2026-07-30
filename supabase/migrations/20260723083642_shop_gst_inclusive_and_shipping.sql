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

-- Shipping: $10 flat, free over $50. Upsert so this applies whether or not the
-- rows already exist (platform_settings predates migration tracking). value is
-- jsonb, matching every other platform_settings row.
--
-- `label` and `group_name` must be supplied: label is NOT NULL with no default,
-- and only one of these two keys already exists in production, so the other
-- takes the INSERT path and needs every not-null column. Labels match the
-- wording already used in Admin → Platform Settings; group_name matches the
-- existing shipping rows. ON CONFLICT deliberately updates only value, so an
-- existing row keeps whatever label and grouping an admin already has.
insert into public.platform_settings (key, value, label, group_name)
values
  ('default_shipping_rate_aud',   '10'::jsonb, 'Default Shipping Rate (AUD)',   'shipping'),
  ('free_shipping_threshold_aud', '50'::jsonb, 'Free Shipping Threshold (AUD)', 'shipping')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
