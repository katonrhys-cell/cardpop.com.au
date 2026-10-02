-- Payment-deadline checks for 20260929211351_offer_payment_deadline.sql.
-- Runs after offers_lifecycle.test.sql in the same throwaway database
-- (same fixture users and listing).
\set ON_ERROR_STOP on

-- A fresh pending offer from the buyer.
insert into public.offers (id, listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at)
values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 4200, now());

-- The seller accepts, and tries to smuggle a 10-year deadline and a paid stamp in.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false) \g /dev/null
update public.offers
   set status = 'accepted', payment_due_at = now() + interval '10 years', paid_at = now(), expires_at = now() + interval '10 years'
 where id = '00000000-0000-0000-0000-000000000301';
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$
declare o record;
begin
  select * into o from public.offers where id = '00000000-0000-0000-0000-000000000301';
  assert o.status = 'accepted', 'accepted';
  assert o.paid_at is null, 'a user cannot mark an offer paid';
  assert o.payment_due_at between now() + interval '47 hours 59 minutes' and now() + interval '48 hours 1 minute',
    'payment window is 48h from acceptance, not what the client sent';
  assert o.expires_at < now() + interval '49 hours', 'a user cannot extend expires_at';
  assert exists (select 1 from public.notifications where related_id = o.id and user_id = o.buyer_id and body like '%pay within 48 hours%'),
    'buyer told to pay within 48 hours';
end $$;

-- The buyer cannot push the deadline back either (and RLS blocks touching an accepted offer at all).
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null
update public.offers set payment_due_at = now() + interval '10 years' where id = '00000000-0000-0000-0000-000000000301';
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$ begin
  assert (select payment_due_at from public.offers where id = '00000000-0000-0000-0000-000000000301') < now() + interval '49 hours',
    'buyer cannot extend the payment window';
end $$;

-- The window closes unpaid: the sweep lapses it and tells buyer, seller and admins.
update public.offers set payment_due_at = now() - interval '1 minute' where id = '00000000-0000-0000-0000-000000000301';
select public.expire_stale_offers() \g /dev/null
do $$ begin
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000301') = 'expired', 'unpaid accepted offer lapses';
  assert exists (select 1 from public.notifications where related_id = '00000000-0000-0000-0000-000000000301'
                  and user_id = '00000000-0000-0000-0000-00000000000b' and title = 'Offer payment window closed'), 'buyer told';
  assert exists (select 1 from public.notifications where related_id = '00000000-0000-0000-0000-000000000301'
                  and user_id = '00000000-0000-0000-0000-00000000000c' and title = 'Buyer didn''t pay'), 'seller told';
  assert exists (select 1 from public.notifications where related_id = '00000000-0000-0000-0000-000000000301'
                  and user_id = '00000000-0000-0000-0000-00000000000a' and title = 'Accepted offer went unpaid'
                  and link = '/admin/offers'), 'admin@cardpop.com.au told';
end $$;

-- A paid offer is never swept, even past its deadline.
insert into public.offers (id, listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at)
values ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 4300, now());
update public.offers set status = 'accepted' where id = '00000000-0000-0000-0000-000000000302';
update public.offers set paid_at = now(), payment_due_at = now() - interval '1 minute' where id = '00000000-0000-0000-0000-000000000302';
select public.expire_stale_offers() \g /dev/null
do $$ begin
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000302') = 'accepted', 'paid offer untouched by the sweep';
end $$;

-- The webhook paying a counter in one update (status + paid_at) needs no deadline.
insert into public.offers (id, listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at)
values ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 4000, now());
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false) \g /dev/null
update public.offers set status = 'countered', counter_amount_aud = 4600 where id = '00000000-0000-0000-0000-000000000303';
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null
update public.offers set status = 'accepted', paid_at = now() where id = '00000000-0000-0000-0000-000000000303';
do $$
declare o record;
begin
  select * into o from public.offers where id = '00000000-0000-0000-0000-000000000303';
  assert o.status = 'accepted' and o.paid_at is not null and o.payment_due_at is null, 'paid counter has no deadline';
end $$;

select 'ALL OFFER PAYMENT CHECKS PASSED' as result;
