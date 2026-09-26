-- Weekly re-scan of an event's source website.
--
-- When an admin gives an event a "website to scrape" (events.source_url) and
-- leaves weekly re-scanning on, the page is scanned straight away and then
-- every seven days. Each scan fetches the page through the SSRF-safe fetcher,
-- extracts it with the same AI extractor the admin scraper uses, and compares
-- the result against the live event:
--
--   • a field the event has no value for yet is filled in automatically
--     (additive only — new information, nothing overwritten);
--   • a factual field that now differs (date, time, venue, price…) is recorded
--     in pending_changes for an admin to apply or dismiss, so a correction an
--     admin made by hand is never silently reverted by the next scan.
--
-- One row per event. Operational, admin-only state: the backend writes it with
-- the service-role key; admins get a read policy so the event form can show
-- the scan status and pending changes. Kept out of `events` because approved
-- events are publicly readable.
--
-- Runbook: docs/event-scanning.md → "Weekly re-scan of an event's website".

create table if not exists public.event_source_watches (
  event_id uuid primary key references public.events(id) on delete cascade,
  url text not null,
  is_active boolean not null default true,
  -- A daily job scans every active watch whose next_scan_at has passed, then
  -- pushes it out seven days. Saving a new URL sets it to now().
  next_scan_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  -- Guards against two scans of the same page at once (the save-time scan and
  -- the daily job, or a double-click).
  scan_started_at timestamptz,
  last_status text
    check (last_status is null or last_status in ('updated', 'changes_found', 'no_change', 'unchanged_page', 'rejected', 'failed')),
  last_message text,
  -- sha256 of the page's readable text. An unchanged page skips the model call
  -- entirely — most weeks most pages don't change.
  content_hash text,
  -- { field: { current, found, found_at } } — differences awaiting an admin.
  pending_changes jsonb not null default '{}'::jsonb,
  -- { field: dismissedValue } — a difference the admin rejected is not
  -- re-proposed until the page says something different again.
  dismissed_changes jsonb not null default '{}'::jsonb,
  -- Fields the scans have filled in automatically, newest last, for the audit
  -- line in the admin form.
  filled_fields jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_source_watches_due_idx
  on public.event_source_watches (next_scan_at)
  where is_active = true;

alter table public.event_source_watches enable row level security;

drop policy if exists "Admins can read event source watches" on public.event_source_watches;
create policy "Admins can read event source watches"
  on public.event_source_watches for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
