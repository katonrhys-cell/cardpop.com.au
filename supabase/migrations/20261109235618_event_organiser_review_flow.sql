-- Organiser side of event review (docs/event-submissions.md).
--
-- 1. Organisers hear the outcome. Approving or rejecting a member's submission
--    bells the organiser (event_approved / event_rejected — values that have
--    existed in the enum all along but nothing sent). The email leg is the
--    API's (POST /events/:id/notify-decision), stamped in
--    events.organiser_notified_status so it is sent once per outcome.
--
-- 2. A rejected event can be edited and resubmitted (status back to
--    pending_review), instead of being a dead end.
--
-- 3. A live event can be changed without taking it down: the organiser's edit
--    becomes an event_change_requests row, the live page stays as it is, and
--    an admin applies (apply_event_change_request) or dismisses it. Only the
--    columns in event_change_request_fields() can ever be requested.
--
-- 4. Organiser writes to events can no longer set admin-only columns
--    (is_featured, is_cardpop_verified, auto_discovered, review stamps,
--    organiser_id, slug). The browser form never sent them for members, but
--    the INSERT/UPDATE policies only checked organiser_id and status, so a
--    hand-made request could submit an event pre-badged "CardPop verified".
--
-- Idempotent throughout. Test: tests/db/run-event-organiser-review-migration.sh

alter type notification_type add value if not exists 'event_change_requested';

alter table public.events add column if not exists organiser_notified_status text;

-- ── Is the caller a CardPop admin? (service role / no JWT → null) ───────────
create or replace function public.event_caller_is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when auth.uid() is null then null
    else coalesce((select is_admin from public.profiles where id = auth.uid()), false)
  end
$$;
revoke execute on function public.event_caller_is_admin() from public, anon;
grant execute on function public.event_caller_is_admin() to authenticated;

-- ── 4. Guard organiser writes on events ─────────────────────────────────────
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
    new.is_featured               := false;
    new.is_cardpop_verified       := false;
    new.auto_discovered           := false;
    new.discovered_at             := null;
    new.reviewed_by               := null;
    new.reviewed_at               := null;
    new.rejection_reason          := null;
    new.organiser_notified_status := null;
  else
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
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_event_organiser_write on public.events;
create trigger trg_guard_event_organiser_write
  before insert or update on public.events
  for each row execute function public.guard_event_organiser_write();

-- ── 2. Rejected events can be resubmitted ───────────────────────────────────
-- USING: the organiser may edit while pending or after a rejection.
-- WITH CHECK: whatever they save goes (back) into the review queue.
drop policy if exists "Organisers can update pending events" on public.events;
create policy "Organisers can update pending events" on public.events
  for update to authenticated
  using ((select auth.uid()) = organiser_id and status in ('pending_review'::event_status, 'rejected'::event_status))
  with check ((select auth.uid()) = organiser_id and status = 'pending_review'::event_status);

-- ── 1. Bell the organiser when their submission is decided ──────────────────
create or replace function public.notify_organiser_on_event_decision()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_title text := coalesce(nullif(btrim(new.title), ''), 'Your event');
  v_reason text := nullif(btrim(coalesce(new.rejection_reason, '')), '');
begin
  if new.organiser_id is null
     or new.organiser_id is not distinct from auth.uid()   -- an admin deciding their own event
     or old.status is distinct from 'pending_review'::event_status
     or new.status not in ('approved'::event_status, 'rejected'::event_status) then
    return new;
  end if;

  if new.status = 'approved' then
    perform create_notification(
      new.organiser_id, 'event_approved',
      'Your event is live',
      v_title || ' has been approved and is now on the CardPop events calendar.',
      '/events/' || coalesce(nullif(new.slug, ''), new.id::text), new.id
    );
  else
    perform create_notification(
      new.organiser_id, 'event_rejected',
      'Your event wasn''t approved',
      v_title || ' wasn''t approved' || coalesce(': ' || v_reason, '.')
        || ' You can edit it and resubmit from My Events.',
      '/account/events', new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_event_decision_notify_organiser on public.events;
create trigger on_event_decision_notify_organiser
  after update of status on public.events
  for each row
  when (old.status is distinct from new.status)
  execute function public.notify_organiser_on_event_decision();

-- ── 3. Change requests on live events ───────────────────────────────────────
-- The only columns an organiser can ask to change. Mirrors
-- EVENT_CHANGE_FIELDS in utils/eventChangeRequests.js (a test keeps them equal).
create or replace function public.event_change_request_fields()
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
    'seo_title', 'seo_description', 'seo_keywords', 'tags'
  ]::text[]
$$;

create table if not exists public.event_change_requests (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.events(id) on delete cascade,
  organiser_id         uuid not null references public.profiles(id) on delete cascade,
  changes              jsonb not null default '{}'::jsonb,
  status               text not null default 'pending',
  review_note          text,
  reviewed_by          uuid references public.profiles(id) on delete set null,
  reviewed_at          timestamptz,
  admins_emailed_at    timestamptz,
  organiser_emailed_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint event_change_requests_status_check check (status in ('pending', 'applied', 'dismissed')),
  constraint event_change_requests_changes_object check (jsonb_typeof(changes) = 'object'),
  constraint event_change_requests_review_note_length check (review_note is null or char_length(review_note) <= 1000)
);

-- One open request per event: a second edit replaces the first.
create unique index if not exists event_change_requests_one_pending
  on public.event_change_requests (event_id) where status = 'pending';
create index if not exists event_change_requests_organiser_idx
  on public.event_change_requests (organiser_id, created_at desc);

alter table public.event_change_requests enable row level security;

drop policy if exists "Organisers read their change requests" on public.event_change_requests;
create policy "Organisers read their change requests" on public.event_change_requests
  for select to authenticated
  using ((select auth.uid()) = organiser_id or (select public.event_caller_is_admin()));

drop policy if exists "Organisers request changes" on public.event_change_requests;
create policy "Organisers request changes" on public.event_change_requests
  for insert to authenticated
  with check ((select auth.uid()) = organiser_id or (select public.event_caller_is_admin()));

drop policy if exists "Organisers edit open change requests" on public.event_change_requests;
create policy "Organisers edit open change requests" on public.event_change_requests
  for update to authenticated
  using (((select auth.uid()) = organiser_id and status = 'pending') or (select public.event_caller_is_admin()))
  with check (((select auth.uid()) = organiser_id and status = 'pending') or (select public.event_caller_is_admin()));

drop policy if exists "Organisers withdraw open change requests" on public.event_change_requests;
create policy "Organisers withdraw open change requests" on public.event_change_requests
  for delete to authenticated
  using (((select auth.uid()) = organiser_id and status = 'pending') or (select public.event_caller_is_admin()));

revoke all on public.event_change_requests from anon;
grant select, insert, update, delete on public.event_change_requests to authenticated;

create or replace function public.guard_event_change_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_admin boolean := public.event_caller_is_admin();
begin
  -- Only requestable columns survive, whoever writes.
  new.changes := coalesce(
    (select jsonb_object_agg(key, value) from jsonb_each(coalesce(new.changes, '{}'::jsonb))
      where key = any(public.event_change_request_fields())),
    '{}'::jsonb);
  new.review_note := nullif(btrim(coalesce(new.review_note, '')), '');
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;

  if v_admin is null or v_admin then
    if tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
      new.reviewed_at := coalesce(new.reviewed_at, now());
      new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.organiser_id := auth.uid();
    if not exists (
      select 1 from public.events
       where id = new.event_id and organiser_id = auth.uid() and status = 'approved'
    ) then
      raise exception 'You can only request changes to your own live events' using errcode = '42501';
    end if;
    new.status               := 'pending';
    new.review_note          := null;
    new.reviewed_by          := null;
    new.reviewed_at          := null;
    new.admins_emailed_at    := null;
    new.organiser_emailed_at := null;
  else
    if new.status is distinct from old.status then
      raise exception 'Only CardPop can apply or dismiss a change request' using errcode = '42501';
    end if;
    new.event_id             := old.event_id;
    new.organiser_id         := old.organiser_id;
    new.review_note          := old.review_note;
    new.reviewed_by          := old.reviewed_by;
    new.reviewed_at          := old.reviewed_at;
    new.admins_emailed_at    := old.admins_emailed_at;
    new.organiser_emailed_at := old.organiser_emailed_at;
  end if;

  if new.changes = '{}'::jsonb then
    raise exception 'There are no changes to review' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_event_change_request on public.event_change_requests;
create trigger trg_guard_event_change_request
  before insert or update on public.event_change_requests
  for each row execute function public.guard_event_change_request();

create or replace function public.notify_on_event_change_request()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_event record;
  v_title text;
  v_fields int := (select count(*) from jsonb_object_keys(new.changes));
  v_admin record;
begin
  select id, title, slug into v_event from public.events where id = new.event_id;
  v_title := coalesce(nullif(btrim(v_event.title), ''), 'An event');

  -- A new (or re-edited) open request → every admin.
  if new.status = 'pending'
     and (tg_op = 'INSERT' or new.changes is distinct from old.changes) then
    for v_admin in select id from public.profiles where is_admin = true loop
      perform create_notification(
        v_admin.id, 'event_change_requested',
        'Event changes to review',
        'The organiser of ' || v_title || ' asked to change ' || v_fields
          || case when v_fields = 1 then ' detail' else ' details' end || '. The live page is unchanged until you apply them.',
        '/admin/events?view=changes', new.event_id
      );
    end loop;
    return new;
  end if;

  -- Decided → the organiser (unless they decided it themselves).
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('applied', 'dismissed')
     and new.organiser_id is distinct from auth.uid() then
    if new.status = 'applied' then
      perform create_notification(
        new.organiser_id, 'event_approved',
        'Your event changes are live',
        'Your changes to ' || v_title || ' have been approved and are now on the event page.',
        '/events/' || coalesce(nullif(v_event.slug, ''), v_event.id::text), new.event_id
      );
    else
      perform create_notification(
        new.organiser_id, 'event_rejected',
        'Your event changes weren''t applied',
        'Your requested changes to ' || v_title || ' weren''t applied' || coalesce(': ' || new.review_note, '.')
          || ' The event page is unchanged.',
        '/account/events', new.event_id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_event_change_request_notify on public.event_change_requests;
create trigger on_event_change_request_notify
  after insert or update on public.event_change_requests
  for each row execute function public.notify_on_event_change_request();

-- Applies an open request to the live event in one transaction, then marks it
-- applied (which bells the organiser). Admins only.
create or replace function public.apply_event_change_request(p_request_id uuid, p_review_note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r public.event_change_requests%rowtype;
  v_cols text;
begin
  if not coalesce(public.event_caller_is_admin(), false) then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select * into r from public.event_change_requests where id = p_request_id for update;
  if not found then
    raise exception 'Change request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'This change request has already been %', r.status using errcode = '22023';
  end if;

  select string_agg(format('%I', k), ', ' order by k) into v_cols
    from jsonb_object_keys(r.changes) k
   where k = any(public.event_change_request_fields());

  if v_cols is not null then
    execute format(
      'update public.events e set (%1$s) = (select %1$s from jsonb_populate_record(null::public.events, $1)) where e.id = $2',
      v_cols)
      using r.changes, r.event_id;
  end if;

  update public.event_change_requests
     set status = 'applied', review_note = p_review_note
   where id = p_request_id;
end;
$$;
revoke execute on function public.apply_event_change_request(uuid, text) from public, anon;
grant execute on function public.apply_event_change_request(uuid, text) to authenticated;
