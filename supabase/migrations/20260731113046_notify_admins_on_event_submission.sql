-- When a regular user submits a community event (status lands as
-- 'pending_review'), fan out an in-app notification to every admin account so
-- the submission doesn't sit unnoticed until someone happens to open
-- Admin -> Events. Auto-discovered events from the nightly scanner
-- (auto_discovered = true) are excluded — those already have their own
-- review queue and firing here for every scanner hit would spam admins.
--
-- Must run as a security-definer trigger: events are inserted straight from
-- the browser under RLS as the submitting user, and public.notifications has
-- no INSERT policy for regular users (same reasoning as notify_on_offer_created
-- in 20260705024521_expression_of_interest_offers.sql).

create or replace function public.notify_admins_on_event_submission()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_admin record;
begin
  if new.status <> 'pending_review' then
    return new;
  end if;
  if coalesce(new.auto_discovered, false) then
    return new;
  end if;
  if new.organiser_id is null then
    return new;
  end if;
  -- On UPDATE only notify when the event just became pending_review
  -- (e.g. a resubmission after rejection) — don't re-notify on every
  -- unrelated edit while it's already sitting in the queue.
  if tg_op = 'UPDATE' and old.status = 'pending_review' then
    return new;
  end if;

  for v_admin in select id from public.profiles where is_admin = true loop
    perform create_notification(
      v_admin.id, 'event_pending_review',
      'New event submitted for review',
      coalesce(new.title, 'An event') || ' needs review before it can go live',
      '/admin/events', new.id
    );
  end loop;

  return new;
end;
$function$;

drop trigger if exists on_event_submission_notify_admins on public.events;
create trigger on_event_submission_notify_admins
  after insert or update of status on public.events
  for each row
  execute function public.notify_admins_on_event_submission();
