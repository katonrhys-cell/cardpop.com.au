-- Behavioural checks for 20261119000153_event_vendor_info.sql. Run by
-- tests/db/run-event-vendor-info-migration.sh; every check is an ASSERT
-- (or an expected exception).
\set ON_ERROR_STOP on

insert into public.profiles (id, display_name, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', true),
  ('00000000-0000-0000-0000-00000000000b', 'Bec Organiser', false),
  ('00000000-0000-0000-0000-00000000000c', 'Someone Else', false);

insert into public.events (id, organiser_id, title, slug, status, start_date)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000b', 'Toy Fair', 'toy-fair', 'approved', current_date + 30);

-- Default: empty object.
do $$ begin
  assert (select vendor_info from public.events where id = '00000000-0000-0000-0000-0000000000e1') = '{}'::jsonb, 'no vendor info by default';
  assert public.event_logged_fields() @> array['vendor_info'], 'vendor_info is change-logged';
end $$;

-- Must be an object.
do $$ begin
  begin
    update public.events set vendor_info = '[]'::jsonb where id = '00000000-0000-0000-0000-0000000000e1';
    assert false, 'an array must be refused';
  exception when check_violation then null;
  end;
end $$;

-- The organiser can set it on their own live event, and the edit is logged.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.events
   set vendor_info = '{"intro":"Tables are 6ft.","faqs":[{"question":"Power?","answer":"Yes"}],"documents":[],"links":[]}'::jsonb,
       vendor_application_url = 'https://toyfair.test/vendors'
 where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ declare l record; begin
  assert (select vendor_info ->> 'intro' from public.events where id = '00000000-0000-0000-0000-0000000000e1') = 'Tables are 6ft.', 'the organiser''s edit applied';
  select * into l from public.event_change_log where event_id = '00000000-0000-0000-0000-0000000000e1';
  assert found and l.changes ? 'vendor_info', 'the edit is logged';
end $$;

-- Another member can't change it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update public.events set vendor_info = '{}'::jsonb where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ begin
  assert (select vendor_info ->> 'intro' from public.events where id = '00000000-0000-0000-0000-0000000000e1') = 'Tables are 6ft.', 'only the organiser can edit it';
end $$;

-- The public view exposes it, and the previous columns are still there.
do $$ declare v record; begin
  select * into v from public.events_public where id = '00000000-0000-0000-0000-0000000000e1';
  assert v.vendor_info -> 'faqs' -> 0 ->> 'question' = 'Power?', 'events_public exposes vendor_info';
  assert v.side_events = '[]'::jsonb and v.vendor_application_url = 'https://toyfair.test/vendors', 'earlier columns kept';
end $$;
