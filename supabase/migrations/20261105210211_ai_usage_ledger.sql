-- AI usage ledger: one row per Claude call the backend makes.
--
-- Written by the API with the service-role key (src/utils/aiUsage.js →
-- recordAiUsage), read by Admin → Finance through ai_usage_summary() and by
-- the monthly allowance check (requireAiAllowance) — never by the browser
-- directly. cost_usd is computed at the published price when the row is
-- written, so a later price change never rewrites history.

create table if not exists public.ai_usage_events (
  id                  bigint generated always as identity primary key,
  created_at          timestamptz not null default now(),
  user_id             uuid references auth.users(id) on delete set null,
  feature             text not null check (char_length(feature) between 1 and 64),
  model               text not null check (char_length(model) between 1 and 64),
  batch               boolean not null default false,
  input_tokens        integer not null default 0 check (input_tokens >= 0),
  output_tokens       integer not null default 0 check (output_tokens >= 0),
  cache_read_tokens   integer not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens  integer not null default 0 check (cache_write_tokens >= 0),
  web_search_requests integer not null default 0 check (web_search_requests >= 0),
  cost_usd            numeric(12, 6) not null default 0 check (cost_usd >= 0)
);

-- The allowance check: this member, this feature, since the 1st.
create index if not exists ai_usage_events_user_feature_created_idx
  on public.ai_usage_events (user_id, feature, created_at desc)
  where user_id is not null;
-- The Finance summary: everything in a date range.
create index if not exists ai_usage_events_created_idx
  on public.ai_usage_events (created_at);

alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from anon, authenticated;

-- Totals per feature and model for [p_from, p_to). Service role only.
create or replace function public.ai_usage_summary(p_from timestamptz, p_to timestamptz)
returns table (
  feature             text,
  model               text,
  calls               bigint,
  members             bigint,
  input_tokens        bigint,
  output_tokens       bigint,
  cache_read_tokens   bigint,
  cache_write_tokens  bigint,
  web_search_requests bigint,
  cost_usd            numeric
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select e.feature,
         e.model,
         count(*)                        as calls,
         count(distinct e.user_id)       as members,
         sum(e.input_tokens)::bigint     as input_tokens,
         sum(e.output_tokens)::bigint    as output_tokens,
         sum(e.cache_read_tokens)::bigint  as cache_read_tokens,
         sum(e.cache_write_tokens)::bigint as cache_write_tokens,
         sum(e.web_search_requests)::bigint as web_search_requests,
         round(sum(e.cost_usd), 4)       as cost_usd
    from public.ai_usage_events e
   where e.created_at >= p_from and e.created_at < p_to
   group by e.feature, e.model
   order by sum(e.cost_usd) desc;
$$;

revoke all on function public.ai_usage_summary(timestamptz, timestamptz) from public, anon, authenticated;

-- The API's service-role client writes the ledger and reads the summary.
-- Granted explicitly rather than relying on the project's default privileges.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, delete on public.ai_usage_events to service_role;
    grant execute on function public.ai_usage_summary(timestamptz, timestamptz) to service_role;
  end if;
end;
$$;

-- The ledger grows by one row per AI call. Keep 18 months (a full financial
-- year plus the BAS quarter after it) by adding it to the daily housekeeping
-- job from 20261105070414_efficiency_housekeeping.sql, which pg_cron already
-- runs at 03:43 AEST. Same body as that migration, plus the ledger prune.
create schema if not exists private;

create or replace function private.run_housekeeping()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.rate_limit_counters
   where window_start < now() - interval '2 days';

  delete from public.ai_usage_events
   where created_at < now() - interval '18 months';

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    delete from cron.job_run_details
     where coalesce(end_time, start_time) < now() - interval '7 days';
  end if;
end;
$$;

revoke all on function private.run_housekeeping() from public, anon, authenticated;
