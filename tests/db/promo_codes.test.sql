-- Behavioural checks for 20261002131905_create_promo_codes.sql.
\set ON_ERROR_STOP 1
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

-- A single-use code: first reservation succeeds, a second (any buyer) is refused.
insert into public.promo_codes (id, code, discount_pct, usage_type)
values ('10000000-0000-0000-0000-000000000001', 'ONEOFF-1', 25, 'single_use');
select public.reserve_promo_code('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'a@x.com', 500);
do $$ begin
  perform public.reserve_promo_code('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'b@x.com', 500);
  raise exception 'single-use code was reserved twice';
exception when others then
  if sqlerrm <> 'promo_exhausted' then raise; end if;
end $$;

-- Releasing the reservation frees it again.
update public.promo_code_redemptions set status = 'released'
 where promo_code_id = '10000000-0000-0000-0000-000000000001';
select public.reserve_promo_code('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'b@x.com', 500);

-- A reservation older than 24h no longer counts.
update public.promo_code_redemptions set reserved_at = now() - interval '25 hours'
 where promo_code_id = '10000000-0000-0000-0000-000000000001' and status = 'reserved';
select public.reserve_promo_code('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'a@x.com', 500);

-- Ongoing, once per customer: same buyer twice is refused, another buyer is fine.
insert into public.promo_codes (id, code, discount_pct, usage_type, once_per_customer)
values ('10000000-0000-0000-0000-000000000002', 'ONGOING', 10, 'ongoing', true);
select public.reserve_promo_code('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', null, 100);
do $$ begin
  perform public.reserve_promo_code('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', null, 100);
  raise exception 'once-per-customer code reserved twice for one buyer';
exception when others then
  if sqlerrm <> 'promo_already_used' then raise; end if;
end $$;
select public.reserve_promo_code('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', null, 100);

-- Total cap.
insert into public.promo_codes (id, code, discount_pct, max_redemptions, once_per_customer)
values ('10000000-0000-0000-0000-000000000003', 'CAPPED', 10, 1, false);
select public.reserve_promo_code('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', null, 100);
do $$ begin
  perform public.reserve_promo_code('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', null, 100);
  raise exception 'capped code exceeded its cap';
exception when others then
  if sqlerrm <> 'promo_exhausted' then raise; end if;
end $$;

-- Expired, not-yet-started and inactive codes are refused.
insert into public.promo_codes (id, code, discount_pct, expires_at)
values ('10000000-0000-0000-0000-000000000004', 'EXPIRED', 10, now() - interval '1 minute');
insert into public.promo_codes (id, code, discount_pct, starts_at)
values ('10000000-0000-0000-0000-000000000005', 'LATER', 10, now() + interval '1 day');
insert into public.promo_codes (id, code, discount_pct, active)
values ('10000000-0000-0000-0000-000000000006', 'PAUSED', 10, false);
do $$
declare r record;
begin
  for r in select * from (values
    ('10000000-0000-0000-0000-000000000004'::uuid, 'promo_expired'),
    ('10000000-0000-0000-0000-000000000005'::uuid, 'promo_not_started'),
    ('10000000-0000-0000-0000-000000000006'::uuid, 'promo_invalid')) v(id, expected)
  loop
    begin
      perform public.reserve_promo_code(r.id, '00000000-0000-0000-0000-00000000000a', null, 100);
      raise exception 'code % was reservable', r.id;
    exception when others then
      if sqlerrm <> r.expected then raise; end if;
    end;
  end loop;
end $$;

-- Codes are uppercase-only and can't collide (case-insensitively) with partner codes.
do $$ begin
  insert into public.promo_codes (code, discount_pct) values ('lower', 10);
  raise exception 'lowercase code accepted';
exception when check_violation then null; end $$;
insert into public.partners (code) values ('STOREX');
do $$ begin
  insert into public.promo_codes (code, discount_pct) values ('STOREX', 10);
  raise exception 'promo code collided with a partner code';
exception when unique_violation then null; end $$;
do $$ begin
  insert into public.partners (code) values ('ongoing');
  raise exception 'partner code collided with a promo code';
exception when unique_violation then null; end $$;

-- A code with redemptions can't be deleted.
do $$ begin
  delete from public.promo_codes where id = '10000000-0000-0000-0000-000000000002';
  raise exception 'deleted a code with redemptions';
exception when foreign_key_violation then null; end $$;

\echo 'promo_codes tests passed'
