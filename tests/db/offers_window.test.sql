-- Behavioural checks for the Expression of Interest offer window
-- (20261003034818_eoi_offer_window_and_open_ended_range.sql). Run by
-- tests/db/run-offer-migrations.sh after offers_lifecycle.test.sql, so the
-- profiles / vault item it inserted already exist.
\set ON_ERROR_STOP on

insert into public.listings (id, seller_id, vault_item_id, listing_type, status, price_min_aud, price_max_aud, offers_open_at, offers_close_at) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f1', 'expression_of_interest', 'active', 100, null, now() + interval '2 days', null),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f1', 'expression_of_interest', 'active', 100, null, null, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f1', 'expression_of_interest', 'active', 100, null, now() - interval '1 day', now() + interval '1 day');

-- A closing date before the opening date, or a max under the min, is refused.
do $$
declare refused int := 0;
begin
  begin
    insert into public.listings (seller_id, listing_type, offers_open_at, offers_close_at)
    values ('00000000-0000-0000-0000-00000000000c', 'expression_of_interest', now() + interval '5 days', now() + interval '1 day');
  exception when check_violation then refused := refused + 1; end;
  begin
    insert into public.listings (seller_id, listing_type, price_min_aud, price_max_aud)
    values ('00000000-0000-0000-0000-00000000000c', 'expression_of_interest', 100, 50);
  exception when check_violation then refused := refused + 1; end;
  assert refused = 2, 'expected 2 constraint refusals, got ' || refused;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null

-- Not open yet, and already closed: refused. Inside the window (min only, no max): accepted.
do $$
declare refused int := 0;
begin
  begin
    insert into public.offers (listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at) values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 150, now());
  exception when check_violation then refused := refused + 1; end;
  begin
    insert into public.offers (listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at) values ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 150, now());
  exception when check_violation then refused := refused + 1; end;
  assert refused = 2, 'expected 2 window refusals, got ' || refused;
  insert into public.offers (listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at) values ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 500, now());
end $$;
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null

select 'ALL OFFER WINDOW CHECKS PASSED' as result;
