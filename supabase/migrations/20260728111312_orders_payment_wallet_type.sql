-- Google Pay brand guidelines ("Put it all together") ask that confirmation
-- pages and receipts indicate specifically when a buyer paid with Google Pay
-- (not just "paid successfully"). Stripe represents Google Pay / Apple Pay
-- payments as payment_method.type === 'card' with card.wallet.type set to
-- 'google_pay' / 'apple_pay' — that wallet type is captured on the order at
-- webhook time (stripeWebhookService.js) so /stripe/session/:id and the order
-- confirmation email can label it correctly.

alter table public.orders
  add column if not exists payment_wallet_type text;

comment on column public.orders.payment_wallet_type is
  'Stripe payment_method.card.wallet.type when the buyer paid via a device wallet (google_pay, apple_pay, …), or ''link'' for Stripe Link. Null for a plain card / other method.';
