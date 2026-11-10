-- Event ownership, organiser edits and admin alerts (docs/event-submissions.md).
--
-- 1. An organiser edits their OWN event, and nothing else. While it's a
--    submission (pending / rejected) a save goes (back) to pending review.
--    Once it's approved a save goes live straight away and stays approved —
--    and every field that changed is written to event_change_log (before →
--    after), which bells every admin and is shown in Admin → Event Management
--    (the email leg is POST /events/:id/notify-changes). This replaces the
--    "request changes → admin applies" flow from 20261109235618, which is
--    dropped here (it never held a row).
--
-- 2. Organisers set their own member ticket offer (code + referral link) on
--    their own event: readable by them, writable while pending / rejected /
--    approved. A change on a live event is logged and alerted like any other.
--
-- 3. Every event a person adds bells every admin (an admin's own event goes to
--    every *other* admin), and resubmissions too. The email leg is POST
--    /events/notify-submission, claimed once through events.admins_notified_at.
--    The nightly scanner's finds keep their own queue.
--
-- 4. Only admins and the event's organiser manage an event's info board,
--    stalls and stall layout (vendors no longer can), and a board post can't
--    be moved onto another event.
--
-- Idempotent. Test: tests/db/run-event-organiser-review-migration.sh.

alter type notification_type add value if not exists 'event_created';
alter type notification_type add value if not exists 'event_updated';

alter table public.events add column if not exists admins_notified_at timestamptz;

-- ── Retire the change-request flow (20261109235618) ─────────────────────────
drop function if exists public.apply_event_change_request(uuid, text);
drop table if exists public.event_change_requests cascade;
drop function if exists public.notify_on_event_change_request();
drop function if exists public.guard_event_change_request();
drop function if exists public.event_change_request_fields();

-- ── The organiser-editable fields that are logged once an event is live ─────
-- Mirrors EVENT_LOGGED_FIELDS in utils/eventChangeLog.js (a test keeps them
-- equal). Status, featuring, ownership, slug and review columns are never
-- organiser-writable (see the guard below), so they aren't here.
create or replace function public.event_logged_fields()
returns text[]
language sql
immutable
as $$
  select array[
    'title', 'short_description', 'description', 'accessibility_info', 'age_restrictions',
    'event_type', 'featured_card_games', 'image_url', 'gallery_images', 'gallery_albums', 'event_videos',
    'venue_name', 'address', 'suburb', 'state', 'postcode',
    'start_date', 'end_date', 'start_time', 'end_time',
    'organizer_name', 'organizer_logo_url', 'organizer_email', 'organizer_phone',
    'website_url', 'ticket_url', 'vendor_application_url',
    'instagram_url', 'facebook_url', 'youtube_url', 'youtube_channel_url', 'tiktok_url', 'x_url', 'discord_url',
    'facebook_video_url',
    'entry_fee_aud', 'presale_fee_aud', 'ticket_prices', 'is_free', 'capacity', 'registration_required',
    'seo_title', 'seo_description', 'seo_keywords', 'tags', 'source_url'
  ]::text[]
$$;

-- ── 1. Organiser writes on events ───────────────────────────────────────────
create or replace function public.guard_event_organiser_write()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_admin boolean := public.event_caller_is_admin();
begin
  -- Service role (the API, the scanner) and admins write anything. Admin
  -- decisions on a submission are stamped here so every path records them.
  if v_admin is null or v_admin then
    if tg_op = 'UPDATE' and old.status = 'pending_review'
       and new.status in ('approved', 'rejected') and new.status is distinct from old.status then
      new.reviewed_at := now();
      new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
      if new.status = 'approved' then new.rejection_reason := null; end if;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.organiser_id              := auth.uid();
    new.status                    := 'pending_review';
    new.is_featured               := false;
    new.is_cardpop_verified       := false;
    new.auto_discovered           := false;
    new.discovered_at             := null;
    new.reviewed_by               := null;
    new.reviewed_at               := null;
    new.rejection_reason          := null;
    new.organiser_notified_status := null;
    new.admins_notified_at        := null;
  else
    -- A live event stays live; a submission (or a rejected one) goes back to
    -- the review queue. The organiser never picks the status.
    new.status := case when old.status = 'approved' then 'approved'::event_status else 'pending_review'::event_status end;
    new.organiser_id              := old.organiser_id;
    new.slug                      := old.slug;
    new.is_featured               := old.is_featured;
    new.is_cardpop_verified       := old.is_cardpop_verified;
    new.auto_discovered           := old.auto_discovered;
    new.discovered_at             := old.discovered_at;
    new.reviewed_by               := old.reviewed_by;
    new.reviewed_at               := old.reviewed_at;
    new.rejection_reason          := old.rejection_reason;
    new.organiser_notified_status := old.organiser_notified_status;
    new.admins_notified_at        := case
      when old.status = 'rejected' then null      -- a resubmission is emailed again
      else old.admins_notified_at
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_event_organiser_write on public.events;
create trigger trg_guard_event_organiser_write
  before insert or update on public.events
  for each row execute function public.guard_event_organiser_write();

-- The organiser of the event — nobody else — may edit it while it's a
-- submission, rejected, or live. Cancelled / completed events are admin-only.
drop policy if exists "Organisers can update pending events" on public.events;
drop policy if exists "Organisers can update their own events" on public.events;
create policy "Organisers can update their own events" on public.events
  for update to authenticated
  using ((select auth.uid()) = organiser_id
         and status in ('pending_review'::event_status, 'rejected'::event_status, 'approved'::event_status))
  with check ((select auth.uid()) = organiser_id
         and status in ('pending_review'::event_status, 'approved'::event_status));

-- ── The change log ──────────────────────────────────────────────────────────
-- One row per organiser save on a live event: { field: { "from": …, "to": … } }.
-- Written only by the triggers below; admins mark rows reviewed.
create table if not exists public.event_change_log (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  changed_by        uuid references public.profiles(id) on delete set null,
  changes           jsonb not null,
  admins_emailed_at timestamptz,
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint event_change_log_changes_object check (jsonb_typeof(changes) = 'object')
);
create index if not exists event_change_log_event_idx on public.event_change_log (event_id, created_at desc);
create index if not exists event_change_log_unreviewed_idx on public.event_change_log (created_at desc) where reviewed_at is null;

alter table public.event_change_log enable row level security;

drop policy if exists "Admins and the editor read the change log" on public.event_change_log;
create policy "Admins and the editor read the change log" on public.event_change_log
  for select to authenticated
  using ((select public.event_caller_is_admin()) or changed_by = (select auth.uid()));

drop policy if exists "Admins mark changes reviewed" on public.event_change_log;
create policy "Admins mark changes reviewed" on public.event_change_log
  for update to authenticated
  using ((select public.event_caller_is_admin()))
  with check ((select public.event_caller_is_admin()));

revoke all on public.event_change_log from anon;
grant select, update on public.event_change_log to authenticated;

-- Marking reviewed stamps who did it (never taken from the client); nothing
-- else about an entry changes after it's written.
create or replace function public.stamp_event_change_review()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.event_id   := old.event_id;
  new.changed_by := old.changed_by;
  new.changes    := old.changes;
  new.created_at := old.created_at;
  if new.reviewed_at is not null and old.reviewed_at is null then
    new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
  elsif new.reviewed_at is not distinct from old.reviewed_at then
    new.reviewed_by := old.reviewed_by;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_event_change_review on public.event_change_log;
create trigger trg_stamp_event_change_review
  before update on public.event_change_log
  for each row execute function public.stamp_event_change_review();

-- Records one organiser save and bells every admin. `changes` is already the
-- { field: { from, to } } map; empty saves record nothing.
create or replace function public.record_event_change(p_event_id uuid, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_event record;
  v_by text;
  v_fields int;
  v_admin record;
begin
  if p_changes is null or p_changes = '{}'::jsonb then return; end if;
  v_fields := (select count(*) from jsonb_object_keys(p_changes));

  insert into public.event_change_log (event_id, changed_by, changes)
  values (p_event_id, auth.uid(), p_changes);

  select id, title into v_event from public.events where id = p_event_id;
  select coalesce(nullif(btrim(display_name), ''), nullif(btrim(username), ''))
    into v_by from public.profiles where id = auth.uid();

  for v_admin in select id from public.profiles where is_admin = true loop
    perform create_notification(
      v_admin.id, 'event_updated',
      'Live event edited',
      coalesce(v_by, 'The organiser') || ' changed ' || v_fields
        || case when v_fields = 1 then ' detail' else ' details' end
        || ' on ' || coalesce(nullif(btrim(v_event.title), ''), 'an event') || '. The changes are live.',
      '/admin/events?view=edits', p_event_id
    );
  end loop;
end;
$$;
revoke execute on function public.record_event_change(uuid, jsonb) from public, anon, authenticated;

-- Organiser saves on a live event → the log.
create or replace function public.log_organiser_event_edit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
begin
  if coalesce(public.event_caller_is_admin(), true) then return new; end if;   -- admins / service role
  if old.status <> 'approved' or new.status <> 'approved' then return new; end if;
  perform public.record_event_change(new.id, coalesce((
    select jsonb_object_agg(f, jsonb_build_object('from', v_old -> f, 'to', v_new -> f))
      from unnest(public.event_logged_fields()) f
     where (v_old -> f) is distinct from (v_new -> f)
  ), '{}'::jsonb));
  return new;
end;
$$;

drop trigger if exists trg_log_organiser_event_edit on public.events;
create trigger trg_log_organiser_event_edit
  after update on public.events
  for each row execute function public.log_organiser_event_edit();

-- ── 3. Bell every admin for every event a person adds ───────────────────────
create or replace function public.notify_admins_on_event_submission()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_admin record;
  v_title text := coalesce(nullif(btrim(new.title), ''), 'An event');
  v_by text;
begin
  if coalesce(new.auto_discovered, false) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Only a resubmission: an event that has just gone (back) to pending.
    if new.status <> 'pending_review' or old.status = 'pending_review' then
      return new;
    end if;
  end if;

  select coalesce(nullif(btrim(display_name), ''), nullif(btrim(username), ''))
    into v_by
    from public.profiles where id = coalesce(auth.uid(), new.organiser_id);

  for v_admin in
    select id from public.profiles
     where is_admin = true
       and id is distinct from auth.uid()   -- not the admin who added it
  loop
    if new.status = 'pending_review' then
      perform create_notification(
        v_admin.id, 'event_pending_review',
        case when tg_op = 'UPDATE' then 'Event resubmitted for review' else 'New event submitted for review' end,
        v_title || coalesce(' from ' || v_by, '') || ' needs review before it can go live',
        '/admin/events', new.id
      );
    else
      perform create_notification(
        v_admin.id, 'event_created',
        'New event added',
        v_title || ' was added' || coalesce(' by ' || v_by, '')
          || case when new.status = 'approved' then ' and is live on the calendar' else ' (' || new.status::text || ')' end || '.',
        '/admin/events', new.id
      );
    end if;
  end loop;

  return new;
end;
$function$;

-- Fires on any update (not "update OF status"): the guard can move the status
-- (a rejected event that's edited goes back to pending) without the statement
-- naming the column, and "OF status" only fires when the statement names it.
drop trigger if exists on_event_submission_notify_admins on public.events;
create trigger on_event_submission_notify_admins
  after insert or update on public.events
  for each row
  execute function public.notify_admins_on_event_submission();

-- Same for the organiser's decision bell (20261109235618).
drop trigger if exists on_event_decision_notify_organiser on public.events;
create trigger on_event_decision_notify_organiser
  after update on public.events
  for each row
  when (old.status is distinct from new.status)
  execute function public.notify_organiser_on_event_decision();

-- ── 2. Organisers manage their own event's ticket offer ─────────────────────
drop policy if exists "Organisers write offers on events under review" on public.event_ticket_offers;
drop policy if exists "Organisers read their event ticket offers" on public.event_ticket_offers;
create policy "Organisers read their event ticket offers"
  on public.event_ticket_offers for select
  to authenticated
  using (exists (
    select 1 from public.events e
     where e.id = event_ticket_offers.event_id and e.organiser_id = (select auth.uid())
  ));

drop policy if exists "Organisers write their event ticket offers" on public.event_ticket_offers;
create policy "Organisers write their event ticket offers"
  on public.event_ticket_offers for all
  to authenticated
  using (exists (
    select 1 from public.events e
     where e.id = event_ticket_offers.event_id and e.organiser_id = (select auth.uid())
       and e.status in ('pending_review'::event_status, 'rejected'::event_status, 'approved'::event_status)
  ))
  with check (exists (
    select 1 from public.events e
     where e.id = event_ticket_offers.event_id and e.organiser_id = (select auth.uid())
       and e.status in ('pending_review'::event_status, 'rejected'::event_status, 'approved'::event_status)
  ));

-- Organiser changes to a live event's offer → the log. Click / reveal counter
-- bumps (any visitor, through the security-definer functions) touch none of
-- these fields, so they never log.
create or replace function public.log_organiser_offer_edit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event_id uuid := coalesce(new.event_id, old.event_id);
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_map constant jsonb := '{"offer_text":"offer_text","discount_code":"discount_code","referral_url":"referral_url","is_active":"offer_is_active"}';
begin
  if coalesce(public.event_caller_is_admin(), true) then return null; end if;
  if not exists (select 1 from public.events where id = v_event_id and status = 'approved') then
    return null;
  end if;
  perform public.record_event_change(v_event_id, coalesce((
    select jsonb_object_agg(m.value #>> '{}', jsonb_build_object('from', v_old -> m.key, 'to', v_new -> m.key))
      from jsonb_each(v_map) m
     where (v_old -> m.key) is distinct from (v_new -> m.key)
  ), '{}'::jsonb));
  return null;   -- AFTER trigger: the return value is ignored
end;
$$;

drop trigger if exists trg_log_organiser_offer_edit on public.event_ticket_offers;
create trigger trg_log_organiser_offer_edit
  after insert or update or delete on public.event_ticket_offers
  for each row execute function public.log_organiser_offer_edit();

-- ── 4. Event board: admins and the event's organiser only ───────────────────
create or replace function public.can_manage_event_board(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_admin = true
    )
    or exists (
      select 1 from public.events
      where id = p_event_id and organiser_id = (select auth.uid())
    );
$function$;

-- A post's author may edit it only while they still manage that event's board,
-- and can't move it onto another event's board.
drop policy if exists "Authors and admins can update board posts" on public.event_board_posts;
create policy "Authors and admins can update board posts" on public.event_board_posts
  for update
  using (
    (((select auth.uid()) = author_id) and public.can_manage_event_board(event_id))
    or exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
  )
  with check (
    (((select auth.uid()) = author_id) and public.can_manage_event_board(event_id))
    or exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
  );
