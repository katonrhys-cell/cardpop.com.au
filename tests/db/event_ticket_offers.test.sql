-- Behavioural checks for the event ticket offers migration. Run by
-- tests/db/run-event-ticket-offer-migration.sh against a throwaway Postgres;
-- every check is an ASSERT (or an expected exception).
\set ON_ERROR_STOP on

insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', true),
  ('00000000-0000-0000-0000-00000000000b', false);
insert into public.events (id, title, status, start_date, end_date) values
  ('00000000-0000-0000-0000-0000000000e1', 'Upcoming', 'approved', current_date + 30, null),
  ('00000000-0000-0000-0000-0000000000e2', 'Finished', 'approved', current_date - 30, null),
  ('00000000-0000-0000-0000-0000000000e3', 'Pending', 'pending_review', current_date + 30, null),
  ('00000000-0000-0000-0000-0000000000e4', 'Still running', 'approved', current_date - 1, current_date + 1);

-- ── Only admins write offers ────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  begin
    insert into public.event_ticket_offers (event_id, discount_code) values ('00000000-0000-0000-0000-0000000000e1', 'HACK');
    raise exception 'a non-admin created an offer';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.event_ticket_offers (event_id, offer_text, discount_code, referral_url, ticket_clicks)
values
  ('00000000-0000-0000-0000-0000000000e1', '  15% off GA  ', ' CARDPOP15 ', 'https://tickets.example/hhxl?ref=cardpop', 999),
  ('00000000-0000-0000-0000-0000000000e2', 'Old', 'OLDCODE', null, 0),
  ('00000000-0000-0000-0000-0000000000e3', 'Pending', 'PENDING', null, 0),
  ('00000000-0000-0000-0000-0000000000e4', null, null, 'https://tickets.example/run', 0);
do $$ declare r record; begin
  select * into r from public.event_ticket_offers where event_id = '00000000-0000-0000-0000-0000000000e1';
  assert r.ticket_clicks = 0, 'an insert cannot seed the counters';
  assert r.offer_text = '15% off GA' and r.discount_code = 'CARDPOP15', 'text is trimmed';
end $$;
do $$ begin
  begin
    insert into public.event_ticket_offers (event_id, referral_url) values ('00000000-0000-0000-0000-0000000000e3', 'javascript:alert(1)');
    raise exception 'a non-http referral link was accepted';
  exception when check_violation then null; end;
end $$;
reset role;

-- ── Anonymous visitors: teaser yes, code no ─────────────────────────────────
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ declare r record; begin
  assert (select count(*) from public.event_ticket_offers) = 0, 'anon reads no offer rows';
exception when insufficient_privilege then null; end $$;
do $$ declare r record; begin
  select * into r from public.get_event_ticket_offer('00000000-0000-0000-0000-0000000000e1');
  assert r.offer_text = '15% off GA', 'teaser is public';
  assert r.has_code, 'teaser says a code exists';
  assert r.referral_url = 'https://tickets.example/hhxl?ref=cardpop', 'referral link is public';
  assert not exists (select 1 from public.get_event_ticket_offer('00000000-0000-0000-0000-0000000000e2')), 'finished event shows no offer';
  assert not exists (select 1 from public.get_event_ticket_offer('00000000-0000-0000-0000-0000000000e3')), 'non-public event shows no offer';
  assert exists (select 1 from public.get_event_ticket_offer('00000000-0000-0000-0000-0000000000e4')), 'a running event still shows its offer';
end $$;
do $$ begin
  begin
    perform public.reveal_event_ticket_code('00000000-0000-0000-0000-0000000000e1');
    raise exception 'anon revealed the code';
  exception when insufficient_privilege then null; end;
end $$;
select public.record_event_ticket_click('00000000-0000-0000-0000-0000000000e1');
select public.record_event_ticket_click('00000000-0000-0000-0000-0000000000e2');
reset role;

-- ── Signed-in member: reveal ────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert public.reveal_event_ticket_code('00000000-0000-0000-0000-0000000000e1') = 'CARDPOP15', 'member sees the code';
  assert public.reveal_event_ticket_code('00000000-0000-0000-0000-0000000000e2') is null, 'no code once the event is over';
  assert public.reveal_event_ticket_code('00000000-0000-0000-0000-0000000000e3') is null, 'no code for a non-public event';
  assert public.reveal_event_ticket_code('00000000-0000-0000-0000-0000000000e4') is null, 'null when the offer has no code';
end $$;
select public.record_event_ticket_click('00000000-0000-0000-0000-0000000000e1');
reset role;

-- ── Counters ────────────────────────────────────────────────────────────────
do $$ declare r record; begin
  select * into r from public.event_ticket_offers where event_id = '00000000-0000-0000-0000-0000000000e1';
  assert r.ticket_clicks = 2, format('two clicks counted, got %s', r.ticket_clicks);
  assert r.code_reveals = 1, 'one reveal counted';
  assert r.last_click_at is not null and r.last_reveal_at is not null, 'timestamps stamped';
  assert (select ticket_clicks from public.event_ticket_offers where event_id = '00000000-0000-0000-0000-0000000000e2') = 0,
    'a finished event does not count clicks';
end $$;

-- An admin save keeps the counters.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.event_ticket_offers set offer_text = '20% off GA', ticket_clicks = 0, code_reveals = 0
 where event_id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ declare r record; begin
  select * into r from public.event_ticket_offers where event_id = '00000000-0000-0000-0000-0000000000e1';
  assert r.offer_text = '20% off GA', 'admin edit applied';
  assert r.ticket_clicks = 2 and r.code_reveals = 1, 'admin save cannot reset counters';
end $$;

-- Deactivated: nothing shown.
update public.event_ticket_offers set is_active = false where event_id = '00000000-0000-0000-0000-0000000000e1';
set role anon;
do $$ begin
  assert not exists (select 1 from public.get_event_ticket_offer('00000000-0000-0000-0000-0000000000e1')), 'inactive offer hidden';
end $$;
reset role;

\echo 'event_ticket_offers: all checks passed'
