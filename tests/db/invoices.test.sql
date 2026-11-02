-- Behavioural checks for 20261102074307_order_invoices.sql.
-- Run by tests/db/run-invoices-migration.sh against a throwaway database.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

begin;

insert into public.platform_settings (key, value, label) values ('gst_rate_pct', '10'::jsonb, 'GST rate');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'buyer@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'seller@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'admin@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'other@example.com');
insert into public.profiles (id, display_name, email, is_admin) values
  ('11111111-1111-1111-1111-111111111111', 'Ash Buyer', 'buyer@example.com', false),
  ('22222222-2222-2222-2222-222222222222', 'Kat Seller', 'seller@example.com', false),
  ('33333333-3333-3333-3333-333333333333', 'Admin', 'admin@example.com', true),
  ('44444444-4444-4444-4444-444444444444', 'Other', 'other@example.com', false);
insert into public.vault_items (id, card_name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Charizard Holo');
insert into public.listings (id, vault_item_id, seller_id) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222');

-- ── 1. A pending cart order has no invoice; paying it issues one ─────────────
-- Shop binder $44.00 (GST 4.00) ×2 = 88.00; card $100 (GST 9.09) + $8 postage
-- (GST 0.73); shop shipping $10 (0.91); service fee $3.00 (0.27); processing
-- $3.64 (0.33); discount $5.00 (−0.45). Total 207.64.
insert into public.orders (id, buyer_id, status, stripe_session_id, order_items,
  item_price_aud, shipping_aud, platform_fee_aud, processing_fee_aud, discount_aud, total_aud,
  gst_aud, gst_included_aud, seller_gst_aud, platform_gst_aud,
  shipping_name, shipping_address, shipping_suburb, shipping_state, shipping_postcode, created_at)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'pending', 'cs_cart_1',
  '[{"type":"shop","id":"prod-1","title":"9-Pocket Binder","quantity":2,"unit_price_aud":44,"line_total_aud":88,"gst_aud":8,"variant_sku":"POG-BIND-RED"},
    {"type":"listing","id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","seller_id":"22222222-2222-2222-2222-222222222222","title":"Charizard Holo","quantity":1,"unit_price_aud":100,"line_total_aud":100,"gst_aud":9.09,"shipping_aud":8,"seller_gst_aud":9.82}]'::jsonb,
  188, 18, 3.00, 3.64, 5.00, 207.64,
  0, 19.50, 9.82, 0.60,
  'Ash Buyer', '1 Collector St', 'Fitzroy', 'VIC', '3065', '2026-10-05 03:00:00+00');

select case when (select count(*) from public.invoices) = 0 then 'ok: pending order has no invoice' else 'FAIL: invoice issued for a pending order' end;

update public.orders set status = 'payment_confirmed' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select case when number = 'INV-000001' and status = 'paid' and total_aud = 207.64 and subtotal_aud = 188
             and shipping_aud = 18 and commission_aud = 3.00 and processing_fee_aud = 3.64 and discount_aud = 5.00
             and gst_aud = 19.50 and seller_gst_aud = 9.82 and adjustment_aud = 0
             and invoice_date = date '2026-10-05' and buyer_name = 'Ash Buyer' and buyer_email = 'buyer@example.com'
             and ship_to->>'postcode' = '3065' and payment_method = 'card'
        then 'ok: cart invoice header' else 'FAIL: cart invoice header ' || row_to_json(i)::text end
  from public.invoices i where order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select case when (select string_agg(l->>'kind', ',' order by ord) from public.invoices i, jsonb_array_elements(i.lines) with ordinality as t(l, ord)
                   where i.order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')
             = 'shop_item,marketplace_item,seller_shipping,shop_shipping,commission,processing_fee,discount'
        then 'ok: cart invoice line kinds' else 'FAIL: cart invoice line kinds ' ||
          (select string_agg(l->>'kind', ',' order by ord) from public.invoices i, jsonb_array_elements(i.lines) with ordinality as t(l, ord) where i.order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') end;

select case when (select sum((l->>'amount_aud')::numeric) from public.invoices i, jsonb_array_elements(i.lines) l where i.order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') = 207.64
        then 'ok: cart lines sum to the total' else 'FAIL: cart lines do not sum to total' end;

select case when (select l from public.invoices i, jsonb_array_elements(i.lines) l where i.order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and l->>'kind' = 'shop_item')
             @> '{"quantity":2,"unit_amount_aud":44,"amount_aud":88,"gst_aud":8,"sku":"POG-BIND-RED","source_id":"prod-1"}'::jsonb
        then 'ok: shop line carries qty, sku and GST' else 'FAIL: shop line' end;

select case when (select l from public.invoices i, jsonb_array_elements(i.lines) l where i.order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and l->>'kind' = 'seller_shipping')
             @> '{"amount_aud":8,"gst_aud":0.73,"seller_id":"22222222-2222-2222-2222-222222222222"}'::jsonb
        then 'ok: seller postage line' else 'FAIL: seller postage line' end;

select case when (select l from public.invoices i, jsonb_array_elements(i.lines) l where i.order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and l->>'kind' = 'shop_shipping')
             @> '{"amount_aud":10,"gst_aud":0.91}'::jsonb
        then 'ok: shop shipping = order shipping minus seller postage' else 'FAIL: shop shipping line' end;

select case when (select l from public.invoices i, jsonb_array_elements(i.lines) l where i.order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and l->>'kind' = 'discount')
             @> '{"amount_aud":-5.00,"gst_aud":-0.45}'::jsonb
        then 'ok: discount is a negative line' else 'FAIL: discount line' end;

-- ── 2. Later lifecycle steps do not re-issue ─────────────────────────────────
update public.orders set status = 'shipped' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
update public.orders set status = 'completed' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select case when (select count(*) from public.invoices) = 1 then 'ok: shipped/completed do not re-issue' else 'FAIL: re-issued on lifecycle step' end;

-- ── 3. Single-item order inserted already paid ───────────────────────────────
insert into public.orders (id, buyer_id, seller_id, listing_id, status, stripe_session_id, stripe_payment_intent_id,
  item_price_aud, shipping_aud, platform_fee_aud, processing_fee_aud, total_aud,
  gst_aud, gst_included_aud, seller_gst_aud, platform_gst_aud, payment_wallet_type,
  billing_business_name, billing_abn, created_at)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'payment_confirmed', 'cs_single_1', 'pi_1',
  101.17, 6.00, 3.04, 2.50, 112.71,
  0, 10.52, 9.74, 0.78, 'google_pay',
  'Collector Pty Ltd', '51824753556', '2026-10-06 13:00:00+00');

select case when number = 'INV-000002' and total_aud = 112.71 and subtotal_aud = 101.17 and shipping_aud = 6
             and buyer_name = 'Collector Pty Ltd' and billing_abn = '51824753556' and payment_method = 'google_pay'
             and invoice_date = date '2026-10-07' -- 13:00 UTC is already the 7th in Sydney
        then 'ok: single-item invoice header' else 'FAIL: single-item header ' || row_to_json(i)::text end
  from public.invoices i where order_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

select case when (select l from public.invoices i, jsonb_array_elements(i.lines) l where i.order_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and l->>'kind' = 'marketplace_item')
             @> '{"description":"Charizard Holo","amount_aud":101.17,"gst_aud":9.20,"seller_id":"22222222-2222-2222-2222-222222222222"}'::jsonb
        then 'ok: single-item card line named from the listing' else 'FAIL: single-item card line' end;

select case when (select sum((l->>'amount_aud')::numeric) from public.invoices i, jsonb_array_elements(i.lines) l where i.order_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') = 112.71
        then 'ok: single-item lines sum to the total' else 'FAIL: single-item lines sum' end;

-- ── 4. Falling back to pending voids; paying again reinstates the same number ─
insert into public.orders (id, buyer_id, status, order_items, item_price_aud, total_aud, gst_included_aud, created_at)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'pending',
  '[{"type":"shop","id":"prod-2","title":"Toploaders","quantity":1,"unit_price_aud":11,"line_total_aud":11,"gst_aud":1}]'::jsonb,
  11, 11, 1, '2026-10-08 00:00:00+00');
update public.orders set status = 'payment_confirmed' where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
update public.orders set status = 'pending' where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
select case when status = 'void' and voided_at is not null then 'ok: invoice voided when order falls back to pending' else 'FAIL: not voided' end
  from public.invoices where order_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
update public.orders set status = 'payment_confirmed' where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
select case when status = 'paid' and voided_at is null and number = 'INV-000003' then 'ok: reinstated with the same number' else 'FAIL: reinstatement ' || status || ' ' || number end
  from public.invoices where order_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
select case when (select count(*) from public.invoices where order_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') = 1 then 'ok: still one invoice' else 'FAIL: duplicate invoice' end;

-- ── 5. Partial refund → credit note for the refunded amount, pro-rata lines ──
insert into public.refunds (order_id, status, refund_amount_aud, processed_at)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'processed', 103.82, now());
update public.orders set status = 'refunded' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select case when number = 'CN-000001' and kind = 'credit_note' and total_aud = 103.82 and status = 'issued'
             and credits_invoice_id = (select id from public.invoices where order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and kind = 'tax_invoice')
             and notes = 'Refund of INV-000001'
        then 'ok: credit note header' else 'FAIL: credit note ' || row_to_json(i)::text end
  from public.invoices i where order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and kind = 'credit_note';

select case when (select sum((l->>'amount_aud')::numeric) from public.invoices i, jsonb_array_elements(i.lines) l
                   where i.order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and i.kind = 'credit_note') = 103.82
        then 'ok: credit note lines sum to the refund' else 'FAIL: credit note lines sum' end;

select case when status = 'credited' and credited_aud = 103.82 then 'ok: invoice marked credited' else 'FAIL: invoice not credited ' || status end
  from public.invoices where order_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and kind = 'tax_invoice';

-- A second refunded transition does not issue a second credit note.
update public.orders set status = 'disputed' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
update public.orders set status = 'refunded' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select case when (select count(*) from public.invoices where kind = 'credit_note') = 1 then 'ok: one credit note per order' else 'FAIL: duplicate credit note' end;

-- ── 6. Refund with no refunds row → full credit ──────────────────────────────
update public.orders set status = 'refunded' where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select case when total_aud = 112.71 and number = 'CN-000002' then 'ok: full credit note defaults to the invoice total' else 'FAIL: full credit note ' || total_aud end
  from public.invoices where order_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and kind = 'credit_note';

-- ── 7. Legacy order: GST was added on top of the commission ──────────────────
insert into public.orders (id, buyer_id, seller_id, listing_id, status, item_price_aud, shipping_aud, platform_fee_aud, gst_aud, total_aud, created_at)
values ('ffffffff-ffff-ffff-ffff-ffffffffffff', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'completed', 50, 5, 5.50, 0.50, 60.50, '2026-08-01 00:00:00+00');
select case when (select l from public.invoices i, jsonb_array_elements(i.lines) l where i.order_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' and l->>'kind' = 'marketplace_item') @> '{"gst_aud":0}'::jsonb
             and (select l from public.invoices i, jsonb_array_elements(i.lines) l where i.order_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' and l->>'kind' = 'commission') @> '{"amount_aud":5.50,"gst_aud":0.50}'::jsonb
             and (select gst_aud from public.invoices where order_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff') = 0.50
        then 'ok: legacy added-on-top GST sits on the commission line' else 'FAIL: legacy GST treatment' end;

-- ── 8. issue_missing_invoices re-issues a deleted document ───────────────────
delete from public.invoices where order_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select case when public.issue_missing_invoices() = 1 then 'ok: issue_missing_invoices issued one' else 'FAIL: issue_missing_invoices count' end;
select case when public.issue_missing_invoices() = 0 then 'ok: issue_missing_invoices is idempotent' else 'FAIL: issue_missing_invoices repeated work' end;

-- ── 9. An invoicing error never fails the order write ────────────────────────
update public.platform_settings set value = '"not a number"'::jsonb where key = 'gst_rate_pct';
insert into public.orders (id, buyer_id, status, order_items, item_price_aud, total_aud, gst_included_aud)
values ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'payment_confirmed',
  '[{"type":"shop","id":"prod-3","title":"Sleeves","quantity":1,"unit_price_aud":5.50,"line_total_aud":5.50,"gst_aud":0.5}]'::jsonb, 5.50, 5.50, 0.5);
select case when (select status from public.orders where id = '99999999-9999-9999-9999-999999999999') = 'payment_confirmed'
             and not exists (select 1 from public.invoices where order_id = '99999999-9999-9999-9999-999999999999')
        then 'ok: order write survives an invoicing error (warning only)' else 'FAIL: fail-safe' end;
update public.platform_settings set value = '10'::jsonb where key = 'gst_rate_pct';
select case when public.issue_missing_invoices() = 1 then 'ok: the missed invoice is picked up by issue_missing_invoices' else 'FAIL: catch-up' end;

-- ── 10. RLS ──────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select case when (select count(*) from public.invoices) = (select count(*) from public.invoices where buyer_id = '11111111-1111-1111-1111-111111111111')
             and (select count(*) from public.invoices) > 0
        then 'ok: buyer reads only their own invoices' else 'FAIL: buyer RLS' end;
select case when (select count(*) from public.invoices where buyer_id = '44444444-4444-4444-4444-444444444444') = 0 then 'ok: other buyers hidden' else 'FAIL: other buyer visible' end;

do $$ begin
  insert into public.invoices (order_id, number, sequence, invoice_date, due_date) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'INV-999999', 999999, current_date, current_date);
  raise exception 'FAIL: authenticated insert allowed';
exception when insufficient_privilege then
  raise notice 'ok: authenticated cannot insert invoices';
end $$;

do $$ begin
  perform public.issue_missing_invoices();
  raise exception 'FAIL: authenticated could call issue_missing_invoices';
exception when insufficient_privilege then
  raise notice 'ok: authenticated cannot call issue_missing_invoices';
end $$;

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select case when (select count(*) from public.invoices) = 7 then 'ok: admin reads every invoice' else 'FAIL: admin RLS ' || (select count(*) from public.invoices) end;
reset role;

rollback;
