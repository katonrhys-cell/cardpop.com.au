-- Confirmed business decision: GST should be calculated on the full sale
-- price (item price + commission), not just CardPop's ~3% commission cut.
-- gst_on_commission_only defaulted to true (the agency-model treatment) and
-- was never explicitly confirmed as intentional — see calculateBreakdown()
-- in src/services/commissionService.js, which already implements both
-- branches correctly; only the stored value needed to change.
--
-- platform_settings predates migration tracking (no earlier migration seeds
-- it), so this is a plain, idempotent UPDATE rather than an insert — the row
-- already exists and is live-editable via the admin Commission Settings page.
update public.platform_settings
set value = 'false'::jsonb, updated_at = now()
where key = 'gst_on_commission_only';
