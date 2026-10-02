-- Verified event organisers.
--
-- An admin can mark a CardPop account as a verified event organiser. A verified
-- organiser may see the vendor list (who RSVP'd "Sell as Vendor") for the
-- events they organise (events.organiser_id = them) — served by
-- GET /events/:id/vendors on the API, which checks this table with the
-- service-role client. Raw event_rsvps rows stay owner/admin-only under RLS.
--
-- Kept as its own table rather than a profiles column so the self-update
-- policy on profiles (which pins every privileged column) doesn't need
-- touching: nobody but the service role can write here at all.

create table if not exists public.event_organiser_verifications (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  verified_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists event_organiser_verifications_verified_by_idx
  on public.event_organiser_verifications (verified_by);

alter table public.event_organiser_verifications enable row level security;

-- A user can see whether they are verified (drives the "Vendors" button in
-- Account → My Events); admins can see everyone. No insert/update/delete
-- policies: writes go through the admin API with the service-role key.
drop policy if exists "event_organiser_verifications_select" on public.event_organiser_verifications;
create policy "event_organiser_verifications_select"
  on public.event_organiser_verifications for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

revoke all on public.event_organiser_verifications from anon;
grant select on public.event_organiser_verifications to authenticated;
