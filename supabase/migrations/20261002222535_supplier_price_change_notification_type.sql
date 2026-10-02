-- Notification type for the weekly supplier price watch
-- (src/services/supplierPriceWatchService.js): admins get a bell notification
-- when a product's supplier page shows a new price, or can no longer be read.
--
-- Its own migration because a new enum value can't be used in the same
-- transaction that adds it. Idempotent.

alter type notification_type add value if not exists 'supplier_price_change';
