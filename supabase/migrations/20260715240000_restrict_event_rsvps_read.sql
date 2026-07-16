-- Stop exposing the raw event_rsvps rows (the user<->event attendance graph).
--
-- The base table had `"Public read event rsvps" for select using (true)`, so
-- anyone with the anon key could read user_id/role for every RSVP and, combined
-- with the (previously) world-readable profiles, de-anonymise who is attending
-- which event:
--   supabase.from('event_rsvps').select('user_id, event_id, role')
--
-- The app only needs two things from this table:
--   1. public buyer/vendor COUNTS per event  -> the event_rsvp_counts view
--   2. the current user's own RSVP            -> fetchMyRsvps (user_id = auth.uid())
-- Nothing legitimately reads other users' raw rows.
--
-- The counts view was security_invoker = true, so it read the base table AS THE
-- CALLER — which means simply restricting the base policy to the owner would
-- collapse the public counts to each caller's own rows. So switch the view to a
-- definer view (security_invoker = false): it runs as the view owner and can
-- still count all rows, while exposing ONLY aggregates (event_id + counts), no
-- user_id. Then replace the world-readable base policy with owner + admin read.

-- 1. Aggregate counts via a definer view so totals survive the base-table lockdown.
--    It deliberately exposes only event_id and the two counts — no PII — which is
--    why running it as owner (bypassing the base RLS) is safe. This intentionally
--    trades a "security definer view" advisor warning for not leaking user_id.
create or replace view public.event_rsvp_counts
  with (security_invoker = false) as
select
  event_id,
  count(*) filter (where role = 'buyer')  as buyer_count,
  count(*) filter (where role = 'vendor') as vendor_count
from public.event_rsvps
group by event_id;

grant select on public.event_rsvp_counts to anon, authenticated;

-- 2. Raw rows: owner reads their own; admins read all. anon can no longer read
--    raw RSVP rows at all (it gets counts from the view instead).
drop policy if exists "Public read event rsvps" on public.event_rsvps;

drop policy if exists "Users read own rsvps" on public.event_rsvps;
create policy "Users read own rsvps"
  on public.event_rsvps for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins read all rsvps" on public.event_rsvps;
create policy "Admins read all rsvps"
  on public.event_rsvps for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- INSERT/UPDATE/DELETE own-row policies are unchanged (auth.uid() = user_id).
