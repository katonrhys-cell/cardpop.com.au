-- Buyer Protection policy, decided 2026-10-03 (utils/buyerProtectionPolicy.js):
-- an approved marketplace refund is a FULL refund — item, postage, service fee
-- and processing fee. Change of mind is never an eligible reason on a
-- marketplace card, so there is no no-fault case left to keep a fee on.
--
-- The retention knobs stay (Admin → Settings can tighten the policy without a
-- deploy) but both now default to "retain nothing". Upsert so a previously
-- seeded 50% is overridden.
insert into public.platform_settings (key, value, label, group_name)
values
  ('refund_fee_retention_pct',     '0'::jsonb,     'Refund: % of platform fee retained',     'refunds'),
  ('refund_retain_processing_fee', 'false'::jsonb, 'Refund: keep the payment processing fee', 'refunds')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
