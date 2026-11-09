-- Add the notification_type values that code already writes but the enum never
-- gained. Each insert with an unknown value fails with
--   invalid input value for enum notification_type: "<value>"
--
-- event_pending_review is the urgent one: notify_admins_on_event_submission()
-- (20260731113046) runs as an AFTER INSERT trigger on public.events, so the
-- failed notification aborted the whole insert — every organiser trying to
-- submit an event got that error toast and nothing was saved.
--
-- The other three are best-effort admin bells written from the API that have
-- been failing silently (the insert error is caught/logged):
--   order_foreign_card  — src/services/stripeWebhookService.js (overseas card refunded)
--   report_escalation   — src/routes/reports.js (content hit the report threshold)
--   sole_trader_changed — src/routes/stores.js (member toggled sole-trader mode)
--
-- `add value if not exists` is idempotent, and nothing here uses the new
-- values in the same transaction, so it is safe under db push.

alter type notification_type add value if not exists 'event_pending_review';
alter type notification_type add value if not exists 'order_foreign_card';
alter type notification_type add value if not exists 'report_escalation';
alter type notification_type add value if not exists 'sole_trader_changed';
