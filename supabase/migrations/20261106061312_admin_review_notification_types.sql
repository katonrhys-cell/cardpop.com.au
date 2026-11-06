-- Admin review alerts: add the notification types the code writes but the
-- notification_type enum never had, and make the event-submission trigger
-- unable to block a submission.
--
-- Why: notify_admins_on_event_submission() (20260731113046) bells every admin
-- with type 'event_pending_review', which was never added to the enum. The
-- literal is cast when create_notification() is called, the cast raises
-- 22P02, and the trigger had no handler — so the error aborted the user's
-- INSERT into events. Every community event submission has failed since
-- 2026-07-31 (the last user-submitted event is 2026-07-16).
--
-- The other values were written by the API with a plain insert whose error
-- was swallowed, so those bells were silently dropped:
--   sole_trader_changed  (src/routes/stores.js)
--   report_escalation    (src/routes/reports.js)
--   order_foreign_card   (src/services/stripeWebhookService.js)
-- and two are new admin review queues (src/services/adminReviewAlerts.js):
--   store_submitted      (Add your store → Admin → Store Directory)
--   partner_application  (Partner program → Admin → Partners)
--
-- ADD VALUE is allowed inside the migration transaction (PG 12+); the new
-- values are only used at runtime, after this commits.

alter type public.notification_type add value if not exists 'event_pending_review';
alter type public.notification_type add value if not exists 'sole_trader_changed';
alter type public.notification_type add value if not exists 'report_escalation';
alter type public.notification_type add value if not exists 'order_foreign_card';
alter type public.notification_type add value if not exists 'store_submitted';
alter type public.notification_type add value if not exists 'partner_application';

-- Same behaviour as before, plus: a notification problem can never fail the
-- submission (mirrors notify_admins_product_review). The email to admins is
-- sent separately by POST /events/notify-submission.
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
  -- (e.g. a resubmission after rejection).
  if tg_op = 'UPDATE' and old.status = 'pending_review' then
    return new;
  end if;

  begin
    for v_admin in select id from public.profiles where is_admin = true loop
      perform create_notification(
        v_admin.id, 'event_pending_review',
        'New event submitted for review',
        coalesce(new.title, 'An event') || ' needs review before it can go live',
        '/admin/events', new.id
      );
    end loop;
  exception when others then
    raise warning 'notify_admins_on_event_submission: % (%)', sqlerrm, sqlstate;
  end;

  return new;
end;
$function$;
