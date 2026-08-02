-- Every notification type the backend writes was missing from notification_type.
--
-- notifications.type is an enum. supabase-js does not throw on a failed insert
-- (it resolves with { error }), and every notification insert in the server
-- ignores that error — usually deliberately, so a notify failure can't fail an
-- order. The combined effect: every single server-side notification since the
-- table was created has been rejected by Postgres and silently dropped. The
-- notifications table is empty.
--
-- That covers, among others: a seller being told their listing sold, a buyer
-- being told their order was confirmed, admins being told an order was
-- oversold, a double sale occurred, a payout failed, or a refund needs
-- attention.
--
-- Adding the labels is the whole fix — the writing code was always correct.
-- Values are additive and idempotent, so this is safe to re-run and safe to
-- land before any app change.

alter type notification_type add value if not exists 'item_sold';
alter type notification_type add value if not exists 'order_confirmed';
alter type notification_type add value if not exists 'order_placed';
alter type notification_type add value if not exists 'order_oversold';
alter type notification_type add value if not exists 'order_double_sale';
alter type notification_type add value if not exists 'order_amount_mismatch';
alter type notification_type add value if not exists 'order_refund_pending';
alter type notification_type add value if not exists 'payment_dispute';
alter type notification_type add value if not exists 'payout_failed';
alter type notification_type add value if not exists 'refund_requested';
alter type notification_type add value if not exists 'refund_approved';
alter type notification_type add value if not exists 'refund_rejected';
alter type notification_type add value if not exists 'refund_issued';
alter type notification_type add value if not exists 'refund_processed';
alter type notification_type add value if not exists 'identity_review';
alter type notification_type add value if not exists 'identity_verified';
alter type notification_type add value if not exists 'verification_requested';
alter type notification_type add value if not exists 'wallet_topup';
alter type notification_type add value if not exists 'wallet_refund';
alter type notification_type add value if not exists 'wallet_over_redemption';
