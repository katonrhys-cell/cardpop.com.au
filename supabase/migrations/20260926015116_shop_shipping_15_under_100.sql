-- CardPop Shop shipping: $15 flat on every order whose shop-item subtotal is
-- under $100; free from $100. Replaces the $10 / free-over-$50 rule seeded by
-- 20260723083642_shop_gst_inclusive_and_shipping.sql. priceCart()
-- (src/services/cartService.js) reads both keys at checkout, so this is the
-- whole server-side change. Upsert so it applies whether or not the rows exist;
-- label and group_name are supplied for the INSERT path (label is NOT NULL) and
-- left untouched on conflict.
insert into public.platform_settings (key, value, label, group_name)
values
  ('default_shipping_rate_aud',   '15'::jsonb,  'Default Shipping Rate (AUD)',   'shipping'),
  ('free_shipping_threshold_aud', '100'::jsonb, 'Free Shipping Threshold (AUD)', 'shipping')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
