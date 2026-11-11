-- Behavioural checks for 20261110221128_event_sold_out_waitlist.sql. Run by
-- tests/db/run-event-sold-out-waitlist-migration.sh; every check is an ASSERT
-- (or an expected exception).
\set ON_ERROR_STOP on

insert into public.profiles (id, display_name, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', true),
  ('00000000-0000-0000-0000-00000000000b', 'Bec Organiser', false),
  ('00000000-0000-0000-0000-00000000000c', 'Someone Else', false);

-- Defaults: not sold out, no waitlist, no fee.
insert into public.events (id, organiser_id, title, slug, status, start_date, is_free, entry_fee_aud)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000b', 'Show', 'show', 'approved', current_date + 30, false, 65);
do $$ declare e record; begin
  select * into e from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert e.tickets_sold_out = false, 'new events are not sold out';
  assert e.waitlist_url is null and e.booking_fee_aud is null, 'no waitlist or fee by default';
end $$;

-- The fee can't be negative.
do $$ begin
  begin
    update public.events set booking_fee_aud = -1 where id = '00000000-0000-0000-0000-0000000000e1';
    assert false, 'a negative booking fee must be refused';
  exception when check_violation then null;
  end;
end $$;

-- The log covers the new fields.
do $$ begin
  assert public.event_logged_fields() @> array['tickets_sold_out', 'waitlist_url', 'booking_fee_aud'], 'new fields are change-logged';
end $$;

-- The organiser can set them on their own live event, and the edit is logged.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.events
   set tickets_sold_out = true, waitlist_url = 'https://events.humanitix.com/waitlist', booking_fee_aud = 3.95,
       ticket_prices = '[{"type":"custom","label":"Player Entry","price_aud":65,"sold_out":true}]'::jsonb
 where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ declare e record; l record; begin
  select * into e from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert e.tickets_sold_out and e.booking_fee_aud = 3.95 and e.waitlist_url like 'https://%', 'the organiser''s edit applied';
  assert e.ticket_prices -> 0 ->> 'label' = 'Player Entry', 'a custom ticket row is stored';
  select * into l from public.event_change_log where event_id = e.id;
  assert found, 'the edit is logged';
  assert l.changes ? 'tickets_sold_out' and l.changes ? 'waitlist_url' and l.changes ? 'booking_fee_aud' and l.changes ? 'ticket_prices',
    'every new field is recorded';
  assert l.changes -> 'tickets_sold_out' = '{"from": false, "to": true}'::jsonb, 'before → after recorded';
end $$;

-- Another member can't change someone else's event.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update public.events set tickets_sold_out = false where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ begin
  assert (select tickets_sold_out from public.events where id = '00000000-0000-0000-0000-0000000000e1'), 'only the organiser can flip sold out';
end $$;

-- The public view exposes the columns, and only for live events.
do $$ declare v record; begin
  select * into v from public.events_public where id = '00000000-0000-0000-0000-0000000000e1';
  assert v.tickets_sold_out and v.booking_fee_aud = 3.95 and v.waitlist_url is not null, 'events_public exposes the new columns';
end $$;
insert into public.events (id, organiser_id, title, slug, status, tickets_sold_out, booking_fee_aud)
values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000b', 'Pending show', 'pending-show', 'pending_review', true, 2.5);
do $$ begin
  assert not exists (select 1 from public.events_public where id = '00000000-0000-0000-0000-0000000000e2'), 'a non-live event stays out of the view';
end $$;
