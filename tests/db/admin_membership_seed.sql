-- Pre-migration state for tests/db/run-admin-membership-migration.sh, on top
-- of profiles_stub_schema.sql (which seeds admin 00…0a and users 00…0b/0c).
--   0a  admin on Hobby — should be backfilled onto complimentary Ultimate
--   0d  admin mid-way through a PAID Premium Stripe subscription — backfilled
--       too (the Stripe side is the server's job), subscription id kept
--   0b  ordinary Hobby user — untouched
--   0e  ordinary PAID Pro member — untouched, and must survive a promote/demote
--       round trip with their paid plan intact
update public.profiles set subscription_tier = 'free', subscription_status = 'none'
 where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
insert into public.profiles (id, username, display_name, is_admin, subscription_tier, subscription_status, subscription_provider, stripe_subscription_id, trial_ends_at) values
  ('00000000-0000-0000-0000-00000000000d', 'paidadmin', 'Paid Admin', true, 'premium', 'active', 'stripe', 'sub_admin', null),
  ('00000000-0000-0000-0000-00000000000e', 'paiduser', 'Paid User', false, 'pro', 'trialing', 'stripe', 'sub_user', now() + interval '10 days');
