-- Records data deletion requests received via Meta's (Facebook) Data Deletion
-- Request callback. When a user removes the CardPop app from their Facebook
-- "Apps and Websites" settings and chooses "Send Request", Facebook POSTs a
-- signed request to our callback (/api/data-deletion/facebook). We record the
-- request here, issue a human-readable confirmation code, and hand back a
-- status URL — as required by Meta's Platform Terms. The user can then check
-- the status of their request on the public /data-deletion page by quoting
-- that code.
--
-- All writes go through the backend with the service-role key (which bypasses
-- RLS). No public read/write policies are granted — the status lookup is served
-- by the backend, not by direct client access to this table.

create table if not exists public.data_deletion_requests (
  id                 uuid primary key default gen_random_uuid(),
  -- Human-readable, alphanumeric confirmation code returned to the user and
  -- quoted back when they check status. Unique so it can key the status lookup.
  confirmation_code  text not null unique,
  -- The app-scoped user ID (ASID) from the Facebook signed request. Nullable
  -- for requests initiated through other channels (email / account settings).
  fb_user_id         text,
  -- How the request arrived: 'facebook' (deletion callback), 'email', 'account'.
  source             text not null default 'facebook',
  -- 'received'  — recorded, not yet actioned
  -- 'completed' — matching account found and soft-disabled / data removed
  -- 'no_data'   — no matching data in our records (per Meta FAQ, disregarded)
  -- 'failed'    — an error occurred while actioning; needs manual follow-up
  status             text not null default 'received',
  -- The CardPop auth user we matched the ASID to, when one was found.
  matched_user_id    uuid,
  -- Free-text note (e.g. failure reason) for manual follow-up.
  notes              text,
  requested_at       timestamptz not null default now(),
  completed_at       timestamptz
);

create index if not exists data_deletion_requests_fb_user_id_idx
  on public.data_deletion_requests (fb_user_id);

alter table public.data_deletion_requests enable row level security;
