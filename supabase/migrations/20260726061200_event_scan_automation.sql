-- Automated nightly discovery of Australian trading-card events.
--
-- The cron job searches the web for events we don't have yet, extracts each
-- candidate page with the same AI extractor the admin scraper panel uses, and
-- files the result in `events` as a `pending_review` draft. Nothing is ever
-- published automatically — a human approves every discovered event in
-- Admin → Event Management.
--
-- Three tables:
--   event_scan_sources    — what to search for (queries + seed listing pages)
--   event_scan_runs       — one row per run, so the admin can see what happened
--   event_scan_candidates — every URL ever considered, keyed by URL so a page
--                           is only fetched and sent to the model once ever
--
-- These are operational tables, not public content: no public read policies.
-- The backend writes them with the service-role key (bypasses RLS); admins get
-- a read policy so the admin UI can render the history from the browser.

create table if not exists public.event_scan_sources (
  id uuid primary key default gen_random_uuid(),
  -- 'search_query' → handed to the model's web-search tool verbatim.
  -- 'seed_url'     → a listing page fetched directly every run (organiser
  --                  calendars, venue "what's on" pages).
  kind text not null default 'search_query'
    check (kind in ('search_query', 'seed_url')),
  value text not null,
  -- Optional label for the admin list; also nudges the extractor's state guess.
  state text check (state is null or state in ('NSW','VIC','QLD','SA','WA','TAS','ACT','NT')),
  label text,
  is_active boolean not null default true,
  -- Lower runs first, so the highest-value queries get the run's budget.
  priority integer not null default 100,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, value)
);

create index if not exists event_scan_sources_active_idx
  on public.event_scan_sources (priority, created_at)
  where is_active = true;

create table if not exists public.event_scan_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  -- 'cron' for the nightly job, 'manual' when an admin presses "Run scan now".
  trigger text not null default 'cron'
    check (trigger in ('cron', 'manual')),
  triggered_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  queries_run integer not null default 0,
  candidates_found integer not null default 0,
  pages_fetched integer not null default 0,
  events_created integer not null default 0,
  duplicates_skipped integer not null default 0,
  -- Non-fatal problems (a page that 404ed, a draft that failed validation).
  -- The run still completes; these are for the admin to glance at.
  warnings jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists event_scan_runs_recent_idx
  on public.event_scan_runs (started_at desc);

create table if not exists public.event_scan_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.event_scan_runs(id) on delete set null,
  source_id uuid references public.event_scan_sources(id) on delete set null,
  -- Scheme/host-normalised, query string and fragment stripped. Unique so a
  -- page discovered again next week is recognised instead of re-extracted —
  -- this is the main cost control on the whole job.
  url text not null unique,
  title text,
  status text not null default 'pending'
    check (status in ('pending', 'imported', 'duplicate', 'rejected', 'failed')),
  -- Why it wasn't imported, in plain English, for the admin list.
  reason text,
  event_id uuid references public.events(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists event_scan_candidates_run_idx
  on public.event_scan_candidates (run_id, status);

-- Distinguish scanner-created drafts from hand-created and user-submitted
-- events, so the admin list can filter to "found overnight, needs review".
alter table public.events
  add column if not exists auto_discovered boolean not null default false;

alter table public.events
  add column if not exists discovered_at timestamptz;

-- The scanner's duplicate check also matches on an existing event's source_url,
-- which is otherwise unindexed and would seq-scan on every candidate.
create index if not exists events_source_url_idx
  on public.events (source_url)
  where source_url is not null;

alter table public.event_scan_sources enable row level security;
alter table public.event_scan_runs enable row level security;
alter table public.event_scan_candidates enable row level security;

drop policy if exists "Admins can read event scan sources" on public.event_scan_sources;
create policy "Admins can read event scan sources"
  on public.event_scan_sources for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins can read event scan runs" on public.event_scan_runs;
create policy "Admins can read event scan runs"
  on public.event_scan_runs for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins can read event scan candidates" on public.event_scan_candidates;
create policy "Admins can read event scan candidates"
  on public.event_scan_candidates for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
