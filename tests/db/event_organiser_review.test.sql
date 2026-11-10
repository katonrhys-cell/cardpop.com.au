-- Behavioural checks for the event organiser migrations
-- (20261109235618_event_organiser_review_flow.sql then
-- 20261110002320_event_organiser_offers_and_admin_alerts.sql). Run by
-- tests/db/run-event-organiser-review-migration.sh against a throwaway
-- Postgres; every check is an ASSERT (or an expected exception).
\set ON_ERROR_STOP on

insert into public.profiles (id, display_name, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', true),
  ('00000000-0000-0000-0000-00000000000d', 'Second Admin', true),
  ('00000000-0000-0000-0000-00000000000b', 'Bec Organiser', false),
  ('00000000-0000-0000-0000-00000000000c', 'Someone Else', false);

do $$ begin
  assert to_regclass('public.event_change_requests') is null, 'the change-request flow is retired';
end $$;

-- ── A member's submission can't pre-badge itself or pick its owner ──────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.events (id, organiser_id, title, slug, status, start_date, is_featured, is_cardpop_verified, auto_discovered, rejection_reason, admins_notified_at)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000b', 'CollectFest Brisbane', 'collectfest-brisbane',
        'pending_review', current_date + 60, true, true, true, 'x', now());
do $$ declare r record; begin
  select * into r from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert r.is_featured = false, 'a member cannot feature their own event';
  assert r.is_cardpop_verified = false, 'a member cannot mark their event CardPop verified';
  assert r.auto_discovered = false and r.rejection_reason is null, 'system columns are cleared on insert';
  assert r.admins_notified_at is null, 'a member cannot pre-stamp the admin email as sent';
end $$;
-- Submitting an event "as" someone else just makes it the submitter's own.
insert into public.events (organiser_id, title, status) values ('00000000-0000-0000-0000-00000000000c', 'Not mine', 'approved');
reset role;
do $$ begin
  assert (select organiser_id from public.events where title = 'Not mine') = '00000000-0000-0000-0000-00000000000b'
     and (select status from public.events where title = 'Not mine') = 'pending_review',
    'a submission always belongs to its submitter and starts pending';
end $$;
delete from public.events where title = 'Not mine';
delete from public.notifications;

do $$ begin
  assert (select count(*) from public.notifications where type = 'event_pending_review') = 0, 'cleared above';
end $$;
-- (re-check the submission bell on a fresh submission)
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.events (id, organiser_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-00000000000b', 'Bell Check', 'pending_review');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where type = 'event_pending_review' and related_id = '00000000-0000-0000-0000-0000000000e9') = 2,
    'every admin is belled about a submission';
  assert (select body from public.notifications where type = 'event_pending_review' limit 1) like '%from Bec Organiser%',
    'the bell names the submitter';
end $$;

-- Editing while pending works, but admin-only columns and the status stay put.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.events set title = 'CollectFest Brisbane 2027', is_featured = true, slug = 'hijacked'
 where id = '00000000-0000-0000-0000-0000000000e1';
do $$ declare r record; begin
  select * into r from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert r.title = 'CollectFest Brisbane 2027', 'organiser can edit a pending event';
  assert r.is_featured = false and r.slug = 'collectfest-brisbane', 'is_featured and slug are not organiser-writable';
  assert r.status = 'pending_review', 'still pending';
end $$;
-- An organiser can't approve their own event.
update public.events set status = 'approved' where id = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  assert (select status from public.events where id = '00000000-0000-0000-0000-0000000000e1') = 'pending_review',
    'an organiser cannot approve their own event';
end $$;
reset role;

-- ── Nobody else can touch it ────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update public.events set title = 'Hijacked' where id = '00000000-0000-0000-0000-0000000000e1';
delete from public.events where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ begin
  assert (select title from public.events where id = '00000000-0000-0000-0000-0000000000e1') = 'CollectFest Brisbane 2027',
    'another member cannot edit or delete someone else''s event';
end $$;

-- ── Admin rejects → organiser is belled with the reason ─────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.events set status = 'rejected', rejection_reason = 'Please add the venue address'
 where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ declare n record; e record; begin
  select * into n from public.notifications where user_id = '00000000-0000-0000-0000-00000000000b' and type = 'event_rejected';
  assert found and n.body like '%Please add the venue address%', 'organiser is belled with the reason';
  select * into e from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert e.reviewed_by = '00000000-0000-0000-0000-00000000000a' and e.reviewed_at is not null, 'the decision is stamped';
end $$;

-- ── Organiser resubmits → pending again, admins belled again ────────────────
update public.events set admins_notified_at = now() where id = '00000000-0000-0000-0000-0000000000e1';
delete from public.notifications;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.events set venue_name = 'Brisbane Convention Centre' where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ declare e record; begin
  select * into e from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert e.status = 'pending_review', 'a rejected event goes back to review when edited';
  assert e.admins_notified_at is null, 'a resubmission is emailed again';
  assert (select count(*) from public.notifications where title = 'Event resubmitted for review') = 2, 'every admin is belled';
end $$;

-- ── Admin approves → organiser is belled with the event link ────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.events set status = 'approved' where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ declare n record; begin
  select * into n from public.notifications where user_id = '00000000-0000-0000-0000-00000000000b' and type = 'event_approved';
  assert found and n.link = '/events/collectfest-brisbane', 'organiser is belled with the live link';
  assert (select rejection_reason from public.events where id = '00000000-0000-0000-0000-0000000000e1') is null,
    'approval clears the old rejection reason';
end $$;

-- ── Live event: the organiser's edit goes live and is logged ────────────────
delete from public.notifications;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.events set start_time = '09:30', venue_name = 'Brisbane Showgrounds', tags = array['pokemon'], title = 'CollectFest Brisbane 2027'
 where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ declare e record; l record; begin
  select * into e from public.events where id = '00000000-0000-0000-0000-0000000000e1';
  assert e.status = 'approved', 'a live event stays live when its organiser edits it';
  assert e.venue_name = 'Brisbane Showgrounds' and e.start_time = '09:30'::time, 'the change is immediate';
  select * into l from public.event_change_log where event_id = '00000000-0000-0000-0000-0000000000e1';
  assert found, 'the edit is logged';
  assert l.changed_by = '00000000-0000-0000-0000-00000000000b', 'logged against the editor';
  assert l.changes -> 'venue_name' = '{"from": "Brisbane Convention Centre", "to": "Brisbane Showgrounds"}'::jsonb, 'before → after recorded';
  assert l.changes ? 'start_time' and l.changes ? 'tags', 'every changed field is recorded';
  assert not (l.changes ? 'title'), 'unchanged fields are not';
  assert (select count(*) from public.notifications where type = 'event_updated'
            and related_id = '00000000-0000-0000-0000-0000000000e1' and body like '%changed 3 details%') = 2,
    'every admin is belled about the live edit';
end $$;

-- A save that changes nothing logs nothing.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.events set venue_name = 'Brisbane Showgrounds' where id = '00000000-0000-0000-0000-0000000000e1';
-- …and they can't take it offline or feature it.
update public.events set status = 'cancelled', is_featured = true where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ begin
  assert (select count(*) from public.event_change_log) = 1, 'a no-op save logs nothing';
  assert (select status from public.events where id = '00000000-0000-0000-0000-0000000000e1') = 'approved'
     and (select is_featured from public.events where id = '00000000-0000-0000-0000-0000000000e1') = false,
    'an organiser cannot change a live event''s status or featuring';
end $$;

-- Admin edits are not logged as organiser edits.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.events set capacity = 900 where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ begin
  assert (select count(*) from public.event_change_log) = 1, 'admin edits are not organiser edits';
end $$;

-- Only admins and the editor can read the log; only admins mark it reviewed.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$ begin
  assert (select count(*) from public.event_change_log) = 0, 'another member cannot read the log';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.event_change_log set reviewed_at = now();
do $$ begin
  assert (select count(*) from public.event_change_log) = 1, 'the editor can read their own entries';
  assert (select reviewed_at from public.event_change_log limit 1) is null, 'the editor cannot mark them reviewed';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.event_change_log set reviewed_at = now(), reviewed_by = '00000000-0000-0000-0000-00000000000c',
       changes = '{"title": {"from": "x", "to": "y"}}';
do $$ declare l record; begin
  select * into l from public.event_change_log limit 1;
  assert l.reviewed_at is not null, 'an admin marks it reviewed';
  assert l.reviewed_by = '00000000-0000-0000-0000-00000000000a', 'the reviewer is the admin who did it, whatever the client sent';
  assert not (l.changes ? 'title') or (l.changes -> 'title' ->> 'to') <> 'y', 'a logged change cannot be rewritten';
end $$;
reset role;

-- ── Ticket offers: own event only; live changes are logged ──────────────────
insert into public.events (id, organiser_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000c', 'Someone Else''s Show', 'approved');
delete from public.notifications;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.event_ticket_offers (event_id, offer_text, discount_code, referral_url)
values ('00000000-0000-0000-0000-0000000000e1', '10% off GA', 'CARDPOP10', 'https://tix.example/?ref=cardpop');
update public.event_ticket_offers set discount_code = 'CARDPOP15' where event_id = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  insert into public.event_ticket_offers (event_id, discount_code) values ('00000000-0000-0000-0000-0000000000e2', 'MINE');
  raise exception 'expected a refusal';
exception when insufficient_privilege then null;
end $$;
reset role;
do $$ declare l record; begin
  assert (select discount_code from public.event_ticket_offers where event_id = '00000000-0000-0000-0000-0000000000e1') = 'CARDPOP15',
    'the organiser sets their own offer on a live event';
  select * into l from public.event_change_log where changes ? 'discount_code' and changes -> 'discount_code' ->> 'to' = 'CARDPOP15';
  assert found and l.changes -> 'discount_code' ->> 'from' = 'CARDPOP10', 'the code change is logged before → after';
  assert exists (select 1 from public.event_change_log where changes -> 'referral_url' ->> 'to' = 'https://tix.example/?ref=cardpop'),
    'adding the offer is logged';
  assert exists (select 1 from public.notifications where type = 'event_updated'), 'admins are belled';
end $$;

-- A visitor's code reveal bumps a counter without logging anything (the
-- reveal function runs as definer with the visitor's JWT).
create temp table log_count as select count(*) as n from public.event_change_log;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update public.event_ticket_offers set code_reveals = code_reveals + 1 where event_id = '00000000-0000-0000-0000-0000000000e1';
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from public.event_change_log) = (select n from log_count), 'counter bumps are not logged';
end $$;

-- ── Admin's own live event bells the *other* admins ─────────────────────────
delete from public.notifications;
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

-- ── Event board: organiser and admins only ──────────────────────────────────
insert into public.event_rsvps (event_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000c', 'vendor');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$ begin
  assert not public.can_manage_event_board('00000000-0000-0000-0000-0000000000e1'), 'a vendor no longer manages the board';
  insert into public.event_board_posts (event_id, author_id, body)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000c', 'Vendor post');
  raise exception 'expected a refusal';
exception when insufficient_privilege then null;
end $$;
-- Their own event's board is theirs; they can't move a post onto Bec's.
insert into public.event_board_posts (id, event_id, author_id, body)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000c', 'My own board');
do $$ begin
  update public.event_board_posts set event_id = '00000000-0000-0000-0000-0000000000e1' where id = '00000000-0000-0000-0000-0000000000b1';
  raise exception 'expected a refusal';
exception when insufficient_privilege then null;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert public.can_manage_event_board('00000000-0000-0000-0000-0000000000e1'), 'the organiser manages their own board';
end $$;
reset role;

\echo 'event organiser review: all checks passed'
