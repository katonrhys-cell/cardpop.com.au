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

-- ════ 20261110002320: organiser offers + admin alerts ═════════════════════
insert into public.profiles (id, display_name, is_admin) values
  ('00000000-0000-0000-0000-00000000000d', 'Second Admin', true);
delete from public.notifications;

-- Every admin hears about a member's submission.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.events (id, organiser_id, title, slug, status, start_date, admins_notified_at)
values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-00000000000b', 'CollectFest Perth', 'collectfest-perth',
        'pending_review', current_date + 90, now());
reset role;
do $$ begin
  assert (select count(*) from public.notifications where type = 'event_pending_review' and related_id = '00000000-0000-0000-0000-0000000000e3') = 2,
    'both admins are belled about a submission';
  assert (select body from public.notifications where type = 'event_pending_review' limit 1) like '%from Bec Organiser%',
    'the bell names the submitter';
  assert (select admins_notified_at from public.events where id = '00000000-0000-0000-0000-0000000000e3') is null,
    'a member cannot pre-stamp the admin email as sent';
end $$;

-- An admin's own live event bells the *other* admins.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.events (id, organiser_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-00000000000a', 'Admin Live Show', 'approved');
reset role;
do $$ begin
  assert exists (select 1 from public.notifications where type = 'event_created' and user_id = '00000000-0000-0000-0000-00000000000d'
                   and body like '%is live on the calendar%'), 'the other admin hears about a live event';
  assert not exists (select 1 from public.notifications where type = 'event_created' and user_id = '00000000-0000-0000-0000-00000000000a'),
    'the admin who added it is not belled';
end $$;

-- The nightly scanner's finds stay out of the bell.
insert into public.events (title, status, auto_discovered) values ('Scanner Find', 'pending_review', true);
do $$ begin
  assert not exists (select 1 from public.notifications n join public.events e on e.id = n.related_id where e.title = 'Scanner Find'),
    'auto-discovered events are not belled';
end $$;

-- Organiser writes a ticket offer on their pending event, and reads it back.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.event_ticket_offers (event_id, offer_text, discount_code, referral_url)
values ('00000000-0000-0000-0000-0000000000e3', '10% off GA', 'CARDPOP10', 'https://tix.example/collectfest?ref=cardpop');
do $$ begin
  assert (select discount_code from public.event_ticket_offers where event_id = '00000000-0000-0000-0000-0000000000e3') = 'CARDPOP10',
    'the organiser can read their own offer';
end $$;
-- …but not on someone else's event.
do $$ begin
  insert into public.event_ticket_offers (event_id, discount_code) values ('00000000-0000-0000-0000-0000000000e4', 'MINE');
  raise exception 'expected a refusal';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  assert not exists (select 1 from public.event_ticket_offers where event_id = '00000000-0000-0000-0000-0000000000e4'),
    'another event''s offer is invisible';
end $$;
reset role;

-- Once the event is live, the organiser can't edit the offer directly…
update public.events set status = 'approved' where id = '00000000-0000-0000-0000-0000000000e3';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.event_ticket_offers set referral_url = 'https://evil.example' where event_id = '00000000-0000-0000-0000-0000000000e3';
do $$ begin
  assert (select referral_url from public.event_ticket_offers where event_id = '00000000-0000-0000-0000-0000000000e3')
    = 'https://tix.example/collectfest?ref=cardpop', 'a live offer is not directly editable';
end $$;
-- …only request it.
insert into public.event_change_requests (id, event_id, organiser_id, changes)
values ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-00000000000b',
        '{"ticket_offer": {"offer_text": "15% off GA", "discount_code": "CARDPOP15", "referral_url": "https://tix.example/new", "is_active": true}}');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.apply_event_change_request('00000000-0000-0000-0000-00000000c004');
reset role;
do $$ declare o record; begin
  select * into o from public.event_ticket_offers where event_id = '00000000-0000-0000-0000-0000000000e3';
  assert o.discount_code = 'CARDPOP15' and o.referral_url = 'https://tix.example/new' and o.offer_text = '15% off GA',
    'an applied offer change updates the offer';
end $$;

-- Removing the offer through a request deletes a row with no history.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.event_change_requests (id, event_id, organiser_id, changes)
values ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-00000000000b',
        '{"ticket_offer": null, "title": "CollectFest Perth 2027"}');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.apply_event_change_request('00000000-0000-0000-0000-00000000c005');
reset role;
do $$ begin
  assert not exists (select 1 from public.event_ticket_offers where event_id = '00000000-0000-0000-0000-0000000000e3'),
    'a removed offer with no clicks is deleted';
  assert (select title from public.events where id = '00000000-0000-0000-0000-0000000000e3') = 'CollectFest Perth 2027',
    'event fields in the same request still apply';
end $$;

-- Resubmitting a rejected event clears the admin-email stamp so admins are emailed again.
update public.events set status = 'rejected', admins_notified_at = now() where id = '00000000-0000-0000-0000-0000000000e3';
delete from public.notifications;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.events set status = 'pending_review' where id = '00000000-0000-0000-0000-0000000000e3';
reset role;
do $$ begin
  assert (select admins_notified_at from public.events where id = '00000000-0000-0000-0000-0000000000e3') is null,
    'a resubmission is emailed again';
  assert (select count(*) from public.notifications where title = 'Event resubmitted for review') = 2,
    'both admins are belled about the resubmission';
end $$;

\echo 'event organiser review: all checks passed'
