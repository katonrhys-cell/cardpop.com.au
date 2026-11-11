-- Player requests.
--
-- A member tagging a card finds the athlete isn't in the Player picker and asks
-- for them to be added. Nothing is created automatically: every admin is belled
-- and emailed (src/routes/player-requests.js), the admin confirms the person is
-- a real athlete, and approval creates the player as an UNPUBLISHED draft in
-- `players` so the admin can write the page and publish it at Admin → Players.
--
-- Writes go through the Express route (service role); there is no browser
-- INSERT/UPDATE policy. A member can read their own requests.
--
-- docs/players.md → Player requests

create table if not exists public.player_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 2 and 120),
  sport         text not null check (char_length(btrim(sport)) between 1 and 60),
  team          text check (team is null or char_length(team) <= 120),
  -- Where an admin can confirm them: a league profile, Wikipedia, a card listing.
  reference_url text check (reference_url is null or reference_url ~* '^https?://[^[:space:]]+$'),
  note          text check (note is null or char_length(note) <= 1000),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  -- The draft (or existing) player the admin linked on approval.
  player_id     uuid references public.players(id) on delete set null,
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists player_requests_status_idx
  on public.player_requests (status, created_at desc);
create index if not exists player_requests_user_idx
  on public.player_requests (user_id);
create index if not exists player_requests_player_idx
  on public.player_requests (player_id);
create index if not exists player_requests_reviewed_by_idx
  on public.player_requests (reviewed_by);
-- The same member can't have the same athlete waiting twice.
create unique index if not exists player_requests_one_pending_per_name
  on public.player_requests (user_id, lower(btrim(name))) where status = 'pending';

comment on table public.player_requests is
  'Member requests to add an athlete to the players catalogue, confirmed by an admin. Written only by the Express API (service role) — src/routes/player-requests.js.';

alter table public.player_requests enable row level security;

drop policy if exists "Members read their player requests" on public.player_requests;
create policy "Members read their player requests"
  on public.player_requests for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.player_requests from anon;
revoke insert, update, delete on public.player_requests from authenticated;
grant select on public.player_requests to authenticated;

-- Notification types (used at runtime only, after this commits).
alter type public.notification_type add value if not exists 'player_request';
alter type public.notification_type add value if not exists 'player_request_approved';
alter type public.notification_type add value if not exists 'player_request_rejected';
