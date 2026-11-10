-- Organiser drafts (docs/event-submissions.md).
--
-- An organiser can save their own event as a `draft`: only they (and admins)
-- see it, it isn't in the review queue and nobody is notified. Submitting it
-- moves it to `pending_review`, which alerts every admin exactly like a new
-- submission. A rejected event can also be parked as a draft while it's
-- reworked. A live event can't go back to draft — it stays approved.
--
-- Needs the `draft` value from 20261110020313_event_status_draft.sql.
-- Idempotent. Test: tests/db/run-event-organiser-review-migration.sh.

-- ── Organiser writes on events: they choose draft or submit ─────────────────
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
    -- A new event is either kept as a draft or submitted.
    new.status := case when new.status = 'draft' then 'draft'::event_status else 'pending_review'::event_status end;
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
    -- A live event stays live. Anything else is kept as a draft or
    -- (re)submitted — the organiser never picks any other status.
    new.status := case
      when old.status = 'approved' then 'approved'::event_status
      when new.status = 'draft' then 'draft'::event_status
      else 'pending_review'::event_status
    end;
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
    -- Each submission (draft → pending, rejected → pending) is emailed to the
    -- admins once; a save that stays pending keeps the stamp.
    new.admins_notified_at := case
      when new.status = 'pending_review' and old.status <> 'pending_review' then null
      else old.admins_notified_at
    end;
  end if;
  return new;
end;
$$;

-- ── Policies: drafts are the organiser's own, like everything else ─────────
drop policy if exists "Authenticated users can submit events" on public.events;
create policy "Authenticated users can submit events" on public.events
  for insert
  with check ((select auth.uid()) = organiser_id
              and status in ('draft'::event_status, 'pending_review'::event_status));

drop policy if exists "Organisers can update their own events" on public.events;
create policy "Organisers can update their own events" on public.events
  for update to authenticated
  using ((select auth.uid()) = organiser_id
         and status in ('draft'::event_status, 'pending_review'::event_status,
                        'rejected'::event_status, 'approved'::event_status))
  with check ((select auth.uid()) = organiser_id
         and status in ('draft'::event_status, 'pending_review'::event_status, 'approved'::event_status));

-- An organiser may delete their own draft (never a submitted or live event).
drop policy if exists "Organisers can delete their own drafts" on public.events;
create policy "Organisers can delete their own drafts" on public.events
  for delete to authenticated
  using ((select auth.uid()) = organiser_id and status = 'draft'::event_status);

-- Their offer on a draft is theirs too.
drop policy if exists "Organisers write their event ticket offers" on public.event_ticket_offers;
create policy "Organisers write their event ticket offers"
  on public.event_ticket_offers for all
  to authenticated
  using (exists (
    select 1 from public.events e
     where e.id = event_ticket_offers.event_id and e.organiser_id = (select auth.uid())
       and e.status in ('draft'::event_status, 'pending_review'::event_status,
                        'rejected'::event_status, 'approved'::event_status)
  ))
  with check (exists (
    select 1 from public.events e
     where e.id = event_ticket_offers.event_id and e.organiser_id = (select auth.uid())
       and e.status in ('draft'::event_status, 'pending_review'::event_status,
                        'rejected'::event_status, 'approved'::event_status)
  ));

-- ── Admin alerts: never for a draft; a draft's submission is a new submission
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
  v_heading text;
begin
  if coalesce(new.auto_discovered, false) or new.status = 'draft' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Only a submission: an event that has just gone (back) to pending.
    if new.status <> 'pending_review' or old.status = 'pending_review' then
      return new;
    end if;
  end if;

  v_heading := case
    when tg_op = 'UPDATE' and old.status = 'rejected' then 'Event resubmitted for review'
    else 'New event submitted for review'
  end;

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
        v_heading,
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
