-- Messages to event organisers.
--
-- A signed-in member writes to an organiser from the organiser's page
-- (/events/organisers/<slug>): feedback, a question, a trader enquiry. Every
-- message is screened before anyone receives it (src/utils/organiserMessageScan.js)
-- and then takes one of three paths:
--
--   delivered  clean, and the page has an owner — the owner is belled and
--              emailed, and reads it in the inbox on their own page.
--   forwarded  clean, but nobody has claimed the page — it goes to the CardPop
--              admins instead.
--   held       the screen flagged it, or could not run. It reaches nobody until
--              an admin releases it (-> released) or dismisses it (-> dismissed).
--
-- The table holds the sender's name and email and the text of private
-- messages, so it has NO browser policy at all: every read and write goes
-- through src/routes/organiser-messages.js with the service role, which is
-- also the only place the screen runs. Never add a browser INSERT policy —
-- that would be a way round the screen.
--
-- docs/organiser-messages.md

create table if not exists public.organiser_messages (
  id            uuid primary key default gen_random_uuid(),
  organiser_id  uuid not null references public.event_organisers(id) on delete cascade,
  sender_id     uuid references auth.users(id) on delete set null,
  -- Snapshot at send time: the organiser replies to this address by email.
  sender_name   text not null check (char_length(sender_name) between 1 and 120),
  sender_email  text not null check (char_length(sender_email) between 3 and 254),
  topic         text not null check (topic in ('feedback', 'question', 'vendor', 'other')),
  body          text not null check (char_length(body) between 10 and 2000),
  status        text not null check (status in ('delivered', 'forwarded', 'held', 'released', 'dismissed')),
  -- The page's owner when it was delivered or released (null = went to CardPop).
  recipient_id  uuid references auth.users(id) on delete set null,
  -- What the screen decided, and why, for the admin reviewing a held message.
  scan_verdict  text not null check (scan_verdict in ('clean', 'flagged', 'unscanned')),
  scan_category text check (scan_category is null or char_length(scan_category) <= 40),
  scan_reason   text check (scan_reason is null or char_length(scan_reason) <= 500),
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.organiser_messages is
  'Member-to-organiser messages, screened before delivery. Service role only — see src/routes/organiser-messages.js.';

-- The organiser's inbox, the sender's daily limits, the admin queue.
create index if not exists organiser_messages_organiser_created_idx
  on public.organiser_messages (organiser_id, created_at desc);
create index if not exists organiser_messages_sender_created_idx
  on public.organiser_messages (sender_id, created_at desc);
create index if not exists organiser_messages_status_created_idx
  on public.organiser_messages (status, created_at desc);

alter table public.organiser_messages enable row level security;
revoke all on public.organiser_messages from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.organiser_messages to service_role;
  end if;
end $$;

-- Bell types: one for the organiser who receives a message, one for the admins
-- (a message held by the screen, or one sent to a page nobody owns).
-- ADD VALUE is allowed inside the migration transaction (PG 12+); the values
-- are only used at runtime, after this commits.
alter type public.notification_type add value if not exists 'organiser_message';
alter type public.notification_type add value if not exists 'organiser_message_review';
