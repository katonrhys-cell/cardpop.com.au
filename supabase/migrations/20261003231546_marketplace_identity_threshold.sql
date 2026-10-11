-- Marketplace ID-check threshold.
--
-- Buying a marketplace (peer-to-peer) card always needs a signed-in account;
-- the Stripe Identity (ID + selfie) check now applies only once the marketplace
-- items in an order reach this value (AUD). 0 = every marketplace order, as
-- before. Read by src/middleware/requireIdentityForPurchase.js and published
-- to the SPA through GET /settings/public so the rule is stated before the
-- till. Editable at Admin → Settings.
insert into public.platform_settings (key, value, label, group_name)
values ('marketplace_identity_threshold_aud', '500'::jsonb, 'Marketplace ID-check Threshold (AUD)', 'marketplace')
on conflict (key) do nothing;
