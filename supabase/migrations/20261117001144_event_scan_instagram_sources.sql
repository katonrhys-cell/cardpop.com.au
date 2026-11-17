-- Instagram as a source for the event scanner.
--
-- The scanner could not read Instagram at all: the site is login-walled, so it
-- is on the web search's blocked list and a fetched post is a consent page.
-- This adds two source kinds that are read through Meta's official Instagram
-- Graph API with CardPop's own account token instead (docs/instagram-event-scan.md):
--
--   instagram_account  value = a handle (lower-case, no @). That account's
--                      recent posts are read through Business Discovery.
--   instagram_tagged   value = 'tagged' (one row). Posts in which another
--                      account tagged CardPop.
--
-- Each post is one event_scan_candidates row keyed by its permalink, so a post
-- is read by the model once ever — the same cost control as a web page.
-- Everything found is still filed as `pending_review`; nothing is published.

alter table public.event_scan_sources
  drop constraint if exists event_scan_sources_kind_check;

alter table public.event_scan_sources
  add constraint event_scan_sources_kind_check
  check (kind in ('search_query', 'seed_url', 'instagram_account', 'instagram_tagged'));

-- Which scan a run row belongs to: the weekly web discovery or the Instagram
-- read. The counters are shared — for an Instagram run queries_run is accounts
-- checked, candidates_found is new posts and pages_fetched is posts read.
alter table public.event_scan_runs
  add column if not exists scope text not null default 'web';

alter table public.event_scan_runs
  drop constraint if exists event_scan_runs_scope_check;

alter table public.event_scan_runs
  add constraint event_scan_runs_scope_check
  check (scope in ('web', 'instagram'));

-- The scanner's duplicate check also asks "does this organiser already have an
-- event on this day?" by Instagram link.
create index if not exists events_instagram_start_date_idx
  on public.events (start_date, instagram_url)
  where instagram_url is not null;

-- Posts that tag CardPop are on from the start: an organiser tagging the
-- account in a show announcement is the clearest signal there is. It reads
-- nothing until the Instagram token is configured.
insert into public.event_scan_sources (kind, value, label, priority)
values ('instagram_tagged', 'tagged', 'Posts that tag CardPop', 10)
on conflict (kind, value) do nothing;
