-- Admin review alerts: the notification types the admin review queues write
-- (src/services/adminReviewAlerts.js), plus the ones the code already wrote
-- that the enum never had.
--
--   store_submitted      (Add your store → Admin → Store Directory)  — new
--   partner_application  (Partner program → Admin → Partners)       — new
--   event_pending_review / sole_trader_changed / report_escalation /
--   order_foreign_card   — already added by 20261109074220 (#1182); repeated
--                          here with `if not exists`, so a no-op in production.
--
-- This migration originally also replaced notify_admins_on_event_submission()
-- to stop a failed bell blocking a submission. That was fixed on main first
-- (20261109074220) and the function has since been rewritten for drafts and
-- resubmissions (20261110002320, 20261110020314). Because this file's version
-- sorts earlier but is applied later (db push --include-all), redefining the
-- function here would overwrite the newer one — so it is deliberately left out.
--
-- ADD VALUE is allowed inside the migration transaction (PG 12+); the new
-- values are only used at runtime, after this commits.

alter type public.notification_type add value if not exists 'event_pending_review';
alter type public.notification_type add value if not exists 'sole_trader_changed';
alter type public.notification_type add value if not exists 'report_escalation';
alter type public.notification_type add value if not exists 'order_foreign_card';
alter type public.notification_type add value if not exists 'store_submitted';
alter type public.notification_type add value if not exists 'partner_application';
