-- Expose the approved events a given user has RSVP'd to, plus the capacity they
-- RSVP'd in (buyer / vendor), so a collector's upcoming shows can be listed on
-- their public profile (SellerProfilePage: "Events").
--
-- The raw event_rsvps rows are hidden by RLS (20260715240000 restricted SELECT
-- to owner + admin) to avoid leaking the whole attendance graph. Showing a
-- profile's own attendance is a deliberate, narrower exposure: this SECURITY
-- DEFINER function returns, for one profile_id, only its RSVPs to APPROVED
-- events (never pending/rejected ones) as (event_id, role) — no other user's
-- rows, and no non-public event data. Event details are then read from the
-- existing public events_public view.
--
-- Mirrors the pattern of get_event_rsvp_counts (20260715280000): a client-
-- callable aggregate/lookup over RLS-restricted rows has to run with definer
-- rights, surfacing as advisor 0029 (SECURITY DEFINER function executable by
-- authenticated) — an accepted WARN, not the 0010 security_definer_view ERROR.

create or replace function public.get_user_event_rsvps(profile_id uuid)
returns table (event_id uuid, role text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select r.event_id, r.role, r.created_at
  from public.event_rsvps r
  join public.events e on e.id = r.event_id
  where r.user_id = profile_id
    and e.status = 'approved'::event_status
  order by e.start_date asc nulls last;
$$;

-- Explicit grants only (no default PUBLIC grant): callable by the browser for
-- public profile event lists; service_role already has it.
revoke execute on function public.get_user_event_rsvps(uuid) from public;
grant execute on function public.get_user_event_rsvps(uuid) to anon, authenticated;
