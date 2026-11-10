-- Organisers manage their own member ticket offers, and every admin hears
-- about every event someone adds (docs/event-submissions.md,
-- docs/event-ticket-offers.md).
--
-- 1. Ticket offers (code + referral link) were admin-only. An organiser can
--    now read their own event's offer (with its click / reveal counts) and
--    write it while the event is pending review or rejected — i.e. it's
--    reviewed with the submission. On a live event an offer change is a
--    change request ('ticket_offer' in event_change_requests.changes), applied
--    by apply_event_change_request(), so a live "Get Tickets" link is never
--    swapped without an admin seeing it.
--
-- 2. Admin alerts on every added event: the bell used to fire only for a
--    member's pending submission. It now fires for any event a person adds
--    (an admin's own live event included — to every *other* admin), and on a
--    resubmission. The nightly scanner's finds (auto_discovered) keep their
--    own review queue. The email leg is POST /events/notify-submission,
--    claimed through events.admins_notified_at so it's sent once per
--    submission.
--
-- Idempotent. Test: tests/db/run-event-organiser-review-migration.sh (runs
-- this file after 20261109235618).

alter type notification_type add value if not exists 'event_created';

alter table public.events add column if not exists admins_notified_at timestamptz;

-- ── Organiser writes: also pin admins_notified_at ───────────────────────────
-- Same as 20261109235618, plus admins_notified_at: cleared on insert and on a
-- resubmission (rejected → pending_review, so the admins are emailed again),
-- otherwise kept.
create or replace function public.guard_event_organiser_write()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_admin boolean := public.event_caller_is_admin();
begin
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
    new.admins_notified_at        := null;
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
    new.admins_notified_at        := case
      when old.status = 'rejected' and new.status = 'pending_review' then null
      else old.admins_notified_at
    end;
  end if;
  return new;
end;
$$;

-- ── 2. Bell every admin for every event a person adds ───────────────────────
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

drop trigger if exists on_event_submission_notify_admins on public.events;
create trigger on_event_submission_notify_admins
  after insert or update of status on public.events
  for each row
  execute function public.notify_admins_on_event_submission();

-- ── 1a. Organisers read and (pre-approval) write their own offer ────────────
drop policy if exists "Organisers read their event ticket offers" on public.event_ticket_offers;
create policy "Organisers read their event ticket offers"
  on public.event_ticket_offers for select
  to authenticated
  using (exists (
    select 1 from public.events e
     where e.id = event_ticket_offers.event_id and e.organiser_id = (select auth.uid())
  ));

drop policy if exists "Organisers write offers on events under review" on public.event_ticket_offers;
create policy "Organisers write offers on events under review"
  on public.event_ticket_offers for all
  to authenticated
  using (exists (
    select 1 from public.events e
     where e.id = event_ticket_offers.event_id and e.organiser_id = (select auth.uid())
       and e.status in ('pending_review'::event_status, 'rejected'::event_status)
  ))
  with check (exists (
    select 1 from public.events e
     where e.id = event_ticket_offers.event_id and e.organiser_id = (select auth.uid())
       and e.status in ('pending_review'::event_status, 'rejected'::event_status)
  ));

-- ── 1b. On a live event, an offer change is a change request ────────────────
-- 'ticket_offer' joins the requestable fields. Its value is
-- { offer_text, discount_code, referral_url, is_active } or null (remove).
-- Mirrors EVENT_CHANGE_FIELDS in utils/eventChangeRequests.js.
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
    'seo_title', 'seo_description', 'seo_keywords', 'tags',
    'ticket_offer'
  ]::text[]
$$;

create or replace function public.apply_event_change_request(p_request_id uuid, p_review_note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r public.event_change_requests%rowtype;
  v_cols text;
  v_offer jsonb;
  v_text text;
  v_code text;
  v_url text;
  v_existing public.event_ticket_offers%rowtype;
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

  -- Event columns (everything requestable except the offer).
  select string_agg(format('%I', k), ', ' order by k) into v_cols
    from jsonb_object_keys(r.changes) k
   where k = any(public.event_change_request_fields()) and k <> 'ticket_offer';

  if v_cols is not null then
    execute format(
      'update public.events e set (%1$s) = (select %1$s from jsonb_populate_record(null::public.events, $1)) where e.id = $2',
      v_cols)
      using r.changes, r.event_id;
  end if;

  -- The member ticket offer (its own table).
  if r.changes ? 'ticket_offer' then
    v_offer := r.changes -> 'ticket_offer';
    if jsonb_typeof(v_offer) = 'object' then
      v_text := nullif(btrim(v_offer ->> 'offer_text'), '');
      v_code := nullif(btrim(v_offer ->> 'discount_code'), '');
      v_url  := nullif(btrim(v_offer ->> 'referral_url'), '');
    end if;
    select * into v_existing from public.event_ticket_offers where event_id = r.event_id;

    if v_text is null and v_code is null and v_url is null then
      -- Remove: keep a row that has history (switched off), drop one that doesn't.
      if found then
        if v_existing.ticket_clicks + v_existing.code_reveals > 0 then
          update public.event_ticket_offers
             set offer_text = null, discount_code = null, referral_url = null, is_active = false
           where event_id = r.event_id;
        else
          delete from public.event_ticket_offers where event_id = r.event_id;
        end if;
      end if;
    else
      insert into public.event_ticket_offers (event_id, offer_text, discount_code, referral_url, is_active)
      values (r.event_id, v_text, v_code, v_url, coalesce((v_offer ->> 'is_active')::boolean, true))
      on conflict (event_id) do update
         set offer_text = excluded.offer_text,
             discount_code = excluded.discount_code,
             referral_url = excluded.referral_url,
             is_active = excluded.is_active;
    end if;
  end if;

  update public.event_change_requests
     set status = 'applied', review_note = p_review_note
   where id = p_request_id;
end;
$$;
revoke execute on function public.apply_event_change_request(uuid, text) from public, anon;
grant execute on function public.apply_event_change_request(uuid, text) to authenticated;
