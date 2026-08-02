-- Notification type for the stuck-payment reconciliation cron
-- (src/services/pendingOrderAlertService.js), which flags orders that Stripe
-- reports as paid but that are still sitting at status 'pending' because
-- checkout.session.completed never reached the webhook.
--
-- Added as its own migration so the enum value lands before the code that
-- writes it — the notification insert is a plain insert and would fail on an
-- unknown enum label.

alter type notification_type add value if not exists 'order_payment_unfulfilled';
