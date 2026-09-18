-- Buyer-paid payment-processing fee.
--
-- CardPop is the merchant of record (buyers are charged on the platform Stripe
-- account; sellers are paid by transfer), so Stripe's processing fee has always
-- come out of platform funds and was silently absorbed by the commission. On
-- small orders and higher-rate payment methods that meant selling at a loss.
-- The fee is now its own Checkout line, charged to the buyer, grossed up so it
-- covers Stripe's cut of the total including itself.
--
-- It is NOT commission: no seller pays it, no GST is added on top of it (it
-- reimburses a GST-inclusive Stripe fee), and it is kept out of
-- platform_fee_aud so revenue reporting still means commission + GST.

alter table public.orders
  add column if not exists processing_fee_aud numeric(10,2) not null default 0;

comment on column public.orders.processing_fee_aud is
  'Buyer-paid reimbursement of Stripe''s processing fee. Platform cost recovery, excluded from platform_fee_aud (commission + GST) and from seller_proceeds_aud. Retained in full on refunds — Stripe does not return its fee.';

-- Rate settings, tunable from Admin → Commission Settings without a deploy.
-- 1.9% + $0.35 covers Stripe AU's domestic card rate (1.75% + $0.30) with a
-- small margin; international cards (3.5%) stay partly absorbed by commission.
-- `do nothing` on conflict, not `do update`: re-running the migration must not
-- stomp a rate the admin has since tuned in the dashboard.
insert into public.platform_settings (key, value, label, description, group_name)
values
  ('processing_fee_enabled',   'true'::jsonb, 'Processing Fee Enabled',
   'Charge the buyer a line covering Stripe''s processing fee. Off = the platform absorbs it out of commission.', 'fees'),
  ('processing_fee_pct',       '1.9'::jsonb,  'Processing Fee (%)',
   'Percentage component. Must exceed Stripe''s rate for the payment methods you accept (AU domestic cards: 1.75%).', 'fees'),
  ('processing_fee_fixed_aud', '0.35'::jsonb, 'Processing Fee Fixed (AUD)',
   'Fixed component per order. Must exceed Stripe''s per-charge fee (AU: $0.30).', 'fees')
on conflict (key) do nothing;
