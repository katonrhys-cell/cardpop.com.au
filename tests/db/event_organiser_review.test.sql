-- Behavioural checks for 20261109235618_event_organiser_review_flow.sql. Run by
-- tests/db/run-event-organiser-review-migration.sh against a throwaway
-- Postgres; every check is an ASSERT (or an expected exception).
\set ON_ERROR_STOP on

insert into public.profiles (id, display_name, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', true),
  ('00000000-0000-0000-0000-00000000000b', 'Bec Organiser', false),
  ('00000000-0000-0000-0000-00000000000c', 'Someone Else', false);

-- ── A member's submission can't pre-badge itself ────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.events (id, organiser_id, title, slug, status, start_date, is_featured, is_cardpop_verified, auto_discovered, rejection_reason)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000b', 'CollectFest Brisbane', 'collectfest-brisbane',
        'pending_review', current_date + 60, true, true, true, 'x');
do $$ declare r record; begin
  select * into r from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert r.is_featured = false, 'a member cannot feature their own event';
  assert r.is_cardpop_verified = false, 'a member cannot mark their event CardPop verified';
  assert r.auto_discovered = false and r.rejection_reason is null, 'system columns are cleared on insert';
end $$;

-- Editing while pending works, but admin-only columns stay put.
update public.events set title = 'CollectFest Brisbane 2027', is_featured = true, slug = 'hijacked'
 where id = '00000000-0000-0000-0000-0000000000e1';
do $$ declare r record; begin
  select * into r from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert r.title = 'CollectFest Brisbane 2027', 'organiser can edit a pending event';
  assert r.is_featured = false and r.slug = 'collectfest-brisbane', 'is_featured and slug are not organiser-writable';
end $$;
reset role;

-- ── Admin rejects → organiser is belled with the reason ─────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.events set status = 'rejected', rejection_reason = 'Please add the venue address'
 where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ declare n record; e record; begin
  select * into n from public.notifications where user_id = '00000000-0000-0000-0000-00000000000b' and type = 'event_rejected';
  assert found, 'organiser is notified of the rejection';
  assert n.body like '%Please add the venue address%', 'the rejection reason is in the notification';
  assert n.link = '/account/events', 'rejection links to My Events';
  select * into e from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert e.reviewed_by = '00000000-0000-0000-0000-00000000000a' and e.reviewed_at is not null, 'the decision is stamped';
end $$;

-- ── Organiser edits the rejected event → it goes back to pending ────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
-- Trying to save it straight to approved is refused by the policy.
do $$ begin
  update public.events set status = 'approved' where id = '00000000-0000-0000-0000-0000000000e1';
  raise exception 'expected the policy to refuse';
exception when insufficient_privilege then null;
end $$;
update public.events set venue_name = 'Brisbane Convention Centre', status = 'pending_review'
 where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ begin
  assert (select status from public.events where id = '00000000-0000-0000-0000-0000000000e1') = 'pending_review',
    'a rejected event can be resubmitted';
end $$;

-- ── Admin approves → organiser is belled with the event link ────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.events set status = 'approved' where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ declare n record; begin
  select * into n from public.notifications where user_id = '00000000-0000-0000-0000-00000000000b' and type = 'event_approved';
  assert found, 'organiser is notified of the approval';
  assert n.link = '/events/collectfest-brisbane', 'approval links to the live event';
  assert (select rejection_reason from public.events where id = '00000000-0000-0000-0000-0000000000e1') is null,
    'approval clears the old rejection reason';
end $$;

-- An admin deciding their own event isn't belled about it.
insert into public.events (id, organiser_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000a', 'Admin Show', 'pending_review');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.events set status = 'approved' where id = '00000000-0000-0000-0000-0000000000e2';
reset role;
do $$ begin
  assert not exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000a' and type = 'event_approved'),
    'no self-notification';
end $$;

-- ── Live event: the organiser can't edit it directly ────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.events set title = 'Sneaky edit' where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ begin
  assert (select title from public.events where id = '00000000-0000-0000-0000-0000000000e1') = 'CollectFest Brisbane 2027',
    'a live event is not directly editable by its organiser';
end $$;

-- ── …but can request changes ────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.event_change_requests (id, event_id, organiser_id, changes, status, review_note)
values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000c',
        '{"start_time": "10:00", "tags": ["pokemon", "mtg"], "venue_name": "Brisbane Showgrounds", "status": "approved", "is_featured": true, "slug": "x"}',
        'applied', 'self-approved');
do $$ declare r record; begin
  select * into r from public.event_change_requests where id = '00000000-0000-0000-0000-00000000c001';
  assert r.organiser_id = '00000000-0000-0000-0000-00000000000b', 'organiser_id is the caller';
  assert r.status = 'pending' and r.review_note is null, 'a request is born pending';
  assert not (r.changes ? 'status') and not (r.changes ? 'is_featured') and not (r.changes ? 'slug'),
    'only requestable columns are kept';
  assert r.changes ? 'venue_name' and r.changes ? 'tags' and r.changes ? 'start_time', 'requestable columns are kept';
end $$;

-- A second open request on the same event is refused (one at a time).
do $$ begin
  insert into public.event_change_requests (event_id, organiser_id, changes)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000b', '{"title": "Again"}');
  raise exception 'expected the unique index to refuse';
exception when unique_violation then null;
end $$;

-- The organiser can't mark it applied themselves.
do $$ begin
  update public.event_change_requests set status = 'applied' where id = '00000000-0000-0000-0000-00000000c001';
  raise exception 'expected a refusal';
exception when insufficient_privilege then null;
end $$;

-- An empty request (only disallowed keys) is refused.
do $$ begin
  update public.event_change_requests set changes = '{"status": "approved"}' where id = '00000000-0000-0000-0000-00000000c001';
  raise exception 'expected a refusal';
exception when invalid_parameter_value then null;
end $$;

-- The organiser can't apply it.
do $$ begin
  perform public.apply_event_change_request('00000000-0000-0000-0000-00000000c001');
  raise exception 'expected a refusal';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Someone else can't request changes to Bec's event.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$ begin
  insert into public.event_change_requests (event_id, organiser_id, changes)
  values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000c', '{"title": "Mine now"}');
  raise exception 'expected a refusal';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  assert (select count(*) from public.event_change_requests) = 0, 'other members cannot see the request';
end $$;
reset role;

do $$ begin
  assert exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000a' and type = 'event_change_requested'),
    'admins are belled about a change request';
end $$;

-- ── Admin applies → live event updated, organiser belled ────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.apply_event_change_request('00000000-0000-0000-0000-00000000c001', 'Thanks!');
reset role;
do $$ declare e record; r record; begin
  select * into e from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert e.venue_name = 'Brisbane Showgrounds', 'text change applied';
  assert e.tags = array['pokemon', 'mtg'], 'array change applied';
  assert e.start_time = '10:00'::time, 'time change applied';
  assert e.status = 'approved' and e.is_featured = false, 'nothing outside the request changed';
  select * into r from public.event_change_requests where id = '00000000-0000-0000-0000-00000000c001';
  assert r.status = 'applied' and r.reviewed_by = '00000000-0000-0000-0000-00000000000a', 'request marked applied';
  assert exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000b'
                  and type = 'event_approved' and title = 'Your event changes are live'), 'organiser belled';
end $$;

-- A single-column request applies too.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.event_change_requests (id, event_id, organiser_id, changes)
values ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000b', '{"capacity": 500}');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.apply_event_change_request('00000000-0000-0000-0000-00000000c002');
reset role;
do $$ begin
  assert (select capacity from public.events where id = '00000000-0000-0000-0000-0000000000e1') = 500, 'single column applied';
end $$;

-- ── Admin dismisses → organiser belled with the note, event untouched ───────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.event_change_requests (id, event_id, organiser_id, changes)
values ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000b', '{"title": "Wrong title"}');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.event_change_requests set status = 'dismissed', review_note = 'Title must match your website'
 where id = '00000000-0000-0000-0000-00000000c003';
reset role;
do $$ begin
  assert (select title from public.events where id = '00000000-0000-0000-0000-0000000000e1') = 'CollectFest Brisbane 2027',
    'a dismissed request leaves the event alone';
  assert exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000b'
                  and type = 'event_rejected' and body like '%Title must match your website%'), 'organiser belled with the note';
end $$;

\echo 'event organiser review: all checks passed'
