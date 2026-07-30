-- Give fixed-price (Buy Now) sales their own commission toggle.
--
-- The admin Commission Settings page rendered two separate switches —
-- "Commission on Buy Now / Fixed" and "Commission on Offers" — but both were
-- bound to the SAME settings key, `commission_on_offers`, and
-- calculateBreakdown() mapped the 'fixed' transaction type onto that key too.
-- Consequences:
--   • Switching off commission for negotiated offers also switched it off for
--     every ordinary Buy Now sale — the platform's primary revenue path — with
--     nothing in the UI indicating that had happened.
--   • The two switches moved in lockstep, so the pair could never express
--     "charge on Buy Now, not on offers" (or the reverse).
--
-- Seed the new key from the existing shared value rather than a hardcoded
-- default, so whatever the admin had configured for the combined toggle carries
-- over verbatim and this migration is behaviour-preserving. Falls back to true
-- (commission charged) only if the old row is somehow absent.
--
-- Note the admin page saves settings with a plain UPDATE ... WHERE key = $1, so
-- a key with no row is a silent no-op — this row must exist for the new toggle
-- to be usable at all.
insert into public.platform_settings (key, value, label, group_name, description)
select
  'commission_on_fixed',
  coalesce(
    (select value from public.platform_settings where key = 'commission_on_offers'),
    'true'::jsonb
  ),
  'Commission on Buy Now / Fixed',
  'commission',
  'Charge commission on fixed-price (Buy Now) listings.'
on conflict (key) do nothing;
