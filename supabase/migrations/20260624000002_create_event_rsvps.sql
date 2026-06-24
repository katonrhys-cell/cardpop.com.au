-- Event RSVPs. Lets signed-in users RSVP to an event as either a "buyer"
-- (attendee) or a "vendor" (selling at the event). One RSVP per user per event;
-- changing role is an upsert. Public can read so attendee/vendor counts can be
-- shown on the events calendar and event pages.

create table if not exists public.event_rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('buyer', 'vendor')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (event_id, user_id)
);

create index if not exists event_rsvps_event_id_idx on public.event_rsvps (event_id);
create index if not exists event_rsvps_user_id_idx  on public.event_rsvps (user_id);

alter table public.event_rsvps enable row level security;

-- Anyone can read RSVPs (used for public attendee / vendor counts).
drop policy if exists "Public read event rsvps" on public.event_rsvps;
create policy "Public read event rsvps"
  on public.event_rsvps for select
  using (true);

-- A signed-in user may create their own RSVP.
drop policy if exists "Users insert own rsvp" on public.event_rsvps;
create policy "Users insert own rsvp"
  on public.event_rsvps for insert
  with check (auth.uid() = user_id);

-- A signed-in user may change their own RSVP (e.g. buyer -> vendor).
drop policy if exists "Users update own rsvp" on public.event_rsvps;
create policy "Users update own rsvp"
  on public.event_rsvps for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A signed-in user may cancel their own RSVP.
drop policy if exists "Users delete own rsvp" on public.event_rsvps;
create policy "Users delete own rsvp"
  on public.event_rsvps for delete
  using (auth.uid() = user_id);

-- Aggregated public counts per event. security_invoker keeps the underlying
-- table's RLS in force (public read), so this exposes nothing extra — just a
-- convenient pre-grouped shape for the frontend to fetch buyer/vendor totals.
create or replace view public.event_rsvp_counts
  with (security_invoker = true) as
select
  event_id,
  count(*) filter (where role = 'buyer')  as buyer_count,
  count(*) filter (where role = 'vendor') as vendor_count
from public.event_rsvps
group by event_id;

grant select on public.event_rsvp_counts to anon, authenticated;
