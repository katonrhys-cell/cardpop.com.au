-- Behavioural checks for the past-events / attendee-review migration. Run by
-- tests/db/run-event-attendee-review-migrations.sh against a throwaway
-- Postgres; every check is an ASSERT (or an expected exception).
\set ON_ERROR_STOP on

insert into public.profiles (id, display_name, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', true),
  ('00000000-0000-0000-0000-00000000000b', 'Sam Collector', false),
  ('00000000-0000-0000-0000-00000000000c', 'Other Collector', false);
insert into public.events (id, title, slug, status, start_date, end_date) values
  ('00000000-0000-0000-0000-0000000000e1', 'Last Month Show', 'last-month', 'approved', current_date - 40, null),
  ('00000000-0000-0000-0000-0000000000e2', 'Next Month Show', 'next-month', 'approved', current_date + 30, null),
  ('00000000-0000-0000-0000-0000000000e3', 'Archived Future Show', 'archived', 'completed', current_date + 30, null),
  ('00000000-0000-0000-0000-0000000000e4', 'Cancelled Past Show', 'cancelled', 'cancelled', current_date - 40, null),
  ('00000000-0000-0000-0000-0000000000e5', 'Still Running', 'running', 'approved', current_date - 3, current_date + 3);

-- ── Visibility ──────────────────────────────────────────────────────────────
set role anon;
do $$ begin
  assert (select count(*) from public.events_public) = 4, 'anon sees approved + completed, never cancelled';
  assert exists (select 1 from public.events_public where slug = 'archived'), 'a completed (archived) event stays public';
  assert not exists (select 1 from public.events_public where slug = 'cancelled'), 'cancelled stays hidden';
  assert (select count(*) from public.event_attendee_reviews) = 0, 'no reviews yet';
end $$;
reset role;

-- ── Only finished events take reviews ───────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);

insert into public.event_attendee_reviews (id, event_id, reviewer_id, rating, title, body, is_visible, hidden_by)
values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000e1',
        '00000000-0000-0000-0000-00000000000b', 4, '  Solid show  ', '  Good vendor mix, parking was rough.  ',
        false, '00000000-0000-0000-0000-00000000000a');
do $$ declare r record; begin
  select * into r from public.event_attendee_reviews where id = '00000000-0000-0000-0000-00000000c001';
  assert r.is_visible = true, 'a client cannot hide (or pre-hide) a review';
  assert r.hidden_by is null and r.hidden_at is null, 'moderation columns must be cleared';
  assert r.reviewer_name = 'Sam Collector', 'reviewer name is snapshotted from the profile';
  assert r.title = 'Solid show', 'title is trimmed';
  assert r.body = 'Good vendor mix, parking was rough.', 'body is trimmed';
end $$;

-- An archived (completed) event takes reviews even if its date is in the future.
insert into public.event_attendee_reviews (event_id, reviewer_id, rating, body)
values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-00000000000b', 5, 'Great day out, would go again.');

-- Upcoming, still running, cancelled: refused.
do $$ declare ev uuid; begin
  foreach ev in array array[
    '00000000-0000-0000-0000-0000000000e2'::uuid,
    '00000000-0000-0000-0000-0000000000e5'::uuid,
    '00000000-0000-0000-0000-0000000000e4'::uuid
  ] loop
    begin
      insert into public.event_attendee_reviews (event_id, reviewer_id, rating, body)
      values (ev, '00000000-0000-0000-0000-00000000000b', 3, 'Should not be accepted.');
      raise exception 'review of an unfinished/hidden event % was accepted', ev;
    exception when invalid_parameter_value then null; end;
  end loop;
end $$;

-- One review per person per event.
do $$ begin
  begin
    insert into public.event_attendee_reviews (event_id, reviewer_id, rating, body)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000b', 2, 'Second attempt here.');
    raise exception 'duplicate review was accepted';
  exception when unique_violation then null; end;
end $$;

-- Cannot write a review as someone else.
do $$ begin
  begin
    insert into public.event_attendee_reviews (event_id, reviewer_id, rating, body)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000c', 2, 'Impersonated review.');
    raise exception 'review under another user id was accepted';
  exception when insufficient_privilege then null; end;
end $$;

-- Body length is enforced (as a different collector, who has no review yet).
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$ begin
  begin
    insert into public.event_attendee_reviews (event_id, reviewer_id, rating, body)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000c', 2, 'short');
    raise exception 'ten-character floor not enforced';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);

-- Author can edit stars/words but not un-hide, re-home or re-own the row.
update public.event_attendee_reviews
   set rating = 3, body = 'Edited: vendor mix was fine, parking still rough.',
       event_id = '00000000-0000-0000-0000-0000000000e3', is_visible = false
 where id = '00000000-0000-0000-0000-00000000c001';
do $$ declare r record; begin
  select * into r from public.event_attendee_reviews where id = '00000000-0000-0000-0000-00000000c001';
  assert r.rating = 3 and r.body like 'Edited:%', 'author edit applies';
  assert r.event_id = '00000000-0000-0000-0000-0000000000e1', 'event cannot be changed';
  assert r.is_visible = true, 'author cannot change visibility';
  assert r.updated_at >= r.created_at, 'updated_at stamped';
end $$;

-- Admins were told.
reset role;
do $$ begin
  assert (select count(*) from public.notifications where type = 'event_review_posted' and user_id = '00000000-0000-0000-0000-00000000000a') = 2,
    'each new review bells every admin once';
  assert (select link from public.notifications where related_id = '00000000-0000-0000-0000-00000000c001') = '/events/last-month',
    'notification links to the event page';
end $$;

-- ── Moderation ──────────────────────────────────────────────────────────────
-- Another user cannot touch it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update public.event_attendee_reviews set rating = 1 where id = '00000000-0000-0000-0000-00000000c001';
delete from public.event_attendee_reviews where id = '00000000-0000-0000-0000-00000000c001';
do $$ begin
  assert (select rating from public.event_attendee_reviews where id = '00000000-0000-0000-0000-00000000c001') = 3,
    'a stranger''s update is a silent no-op under RLS';
end $$;

-- Admin hides it; it leaves the public view and the stats.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.event_attendee_reviews set is_visible = false where id = '00000000-0000-0000-0000-00000000c001';
do $$ declare r record; begin
  select * into r from public.event_attendee_reviews where id = '00000000-0000-0000-0000-00000000c001';
  assert r.is_visible = false, 'admin can hide';
  assert r.hidden_by = '00000000-0000-0000-0000-00000000000a' and r.hidden_at is not null, 'hide is attributed';
end $$;
set role anon;
do $$ begin
  assert not exists (select 1 from public.event_attendee_reviews where id = '00000000-0000-0000-0000-00000000c001'),
    'hidden review is not public';
  assert (select review_count from public.event_attendee_review_stats where event_id = '00000000-0000-0000-0000-0000000000e3') = 1,
    'stats count visible reviews';
  assert not exists (select 1 from public.event_attendee_review_stats where event_id = '00000000-0000-0000-0000-0000000000e1'),
    'a hidden review drops out of the stats';
end $$;
reset role;
-- The author still sees their own hidden review.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert exists (select 1 from public.event_attendee_reviews where id = '00000000-0000-0000-0000-00000000c001'),
    'author can still read their hidden review';
end $$;
-- Author can delete their own.
delete from public.event_attendee_reviews where id = '00000000-0000-0000-0000-00000000c001';
do $$ begin
  assert not exists (select 1 from public.event_attendee_reviews where id = '00000000-0000-0000-0000-00000000c001'), 'author delete';
end $$;
reset role;

select 'event_attendee_reviews: all checks passed' as result;
