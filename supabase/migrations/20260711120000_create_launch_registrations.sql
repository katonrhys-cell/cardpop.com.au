-- Pre-launch registrations: the email-capture list for the "register now for
-- limited-time Pro early access" landing modal shown while CardPop is still
-- being built (target launch late 2026, P2P trading and other features not yet
-- live). Each registrant is also pushed to the Kit.com "launch" form for
-- marketing; this table is our own source of truth so we can reserve their
-- Pro-level early access and reconcile it against real accounts at launch.
--
-- All writes go through the backend with the service-role key (which bypasses
-- RLS). No public read/write policies are granted — the list is private.

create table if not exists public.launch_registrations (
  id                    uuid primary key default gen_random_uuid(),
  email                 text not null,
  first_name            text,
  -- Where the signup came from (e.g. 'launch_modal', 'launch_page') for basic
  -- attribution; not user-controlled beyond a small allow-list in the backend.
  source                text not null default 'launch_modal',
  -- Every early registrant has Pro-level early access reserved for launch.
  pro_reserved          boolean not null default true,
  -- Stamped once the welcome email (with the early-access PDF) actually sends,
  -- so re-submitting the same email never re-sends it.
  welcome_email_sent_at timestamptz,
  created_at            timestamptz not null default now()
);

-- Emails are stored already lower-cased by the backend; this keeps lookups and
-- the unique constraint case-insensitive in practice.
create unique index if not exists launch_registrations_email_lower_idx
  on public.launch_registrations (lower(email));

alter table public.launch_registrations enable row level security;
