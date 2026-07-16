-- Replace the event_rsvp_counts SECURITY DEFINER *view* with a SECURITY DEFINER
-- *function*, clearing Security Advisor 0010 (security_definer_view — an ERROR).
--
-- Same purpose as 20260715240000: expose public per-event buyer/vendor counts
-- while keeping the raw event_rsvps rows (the attendance graph) hidden. The
-- function aggregates as the owner and returns only event_id + counts (never
-- user_id), so it exposes no more than the view did.
--
-- A client-callable aggregate over RLS-restricted rows has to run with definer
-- rights either way, so this surfaces instead as advisor 0029 (a SECURITY
-- DEFINER function executable by authenticated) — a WARN in the same accepted
-- category as accept_trade, rather than the 0010 ERROR. Net: ERROR downgraded to
-- an expected warning.

drop view if exists public.event_rsvp_counts;

create or replace function public.get_event_rsvp_counts(event_ids uuid[])
returns table (event_id uuid, buyer_count bigint, vendor_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select r.event_id,
         count(*) filter (where r.role = 'buyer')  as buyer_count,
         count(*) filter (where r.role = 'vendor') as vendor_count
  from public.event_rsvps r
  where r.event_id = any(event_ids)
  group by r.event_id;
$$;

-- Explicit grants only (no default PUBLIC grant), so the ACL stays clean:
-- callable by the browser for public counts; service_role already has it.
revoke execute on function public.get_event_rsvp_counts(uuid[]) from public;
grant execute on function public.get_event_rsvp_counts(uuid[]) to anon, authenticated;
