-- Shared store for security-sensitive Express rate limiters
-- (SECURITY_AUDIT_2026-07-21 → M4).
--
-- The Express limiters use express-rate-limit's default in-memory MemoryStore.
-- On Vercel the API is a serverless function fanned out across instances, so an
-- in-memory counter only limits ONE instance — the effective cap is max ×
-- instanceCount and every cold start resets it. For the security-sensitive,
-- low-volume limiters (MFA backup-code brute-force, email-triggering resend /
-- welcome-offer, pwned-check HIBP proxy, login/password advisory) that
-- multiplication is a real weakness. Back those with a shared Postgres counter
-- so the cap is global. High-volume limiters (global/api) stay in-memory —
-- Cloudflare's edge rate-limiting is the authoritative volumetric layer (see
-- docs/ddos-protection.md) and a DB write per request would be wrong.
--
-- Service-role backend only: RLS enabled with no policy (deny-all to
-- anon/authenticated), and the RPC's EXECUTE is granted only to service_role.

create table if not exists public.rate_limit_counters (
  key          text primary key,
  hits         integer not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limit_counters enable row level security;

-- Atomically register one hit against a key within a sliding fixed window and
-- return the running count + when the window resets. A single INSERT ... ON
-- CONFLICT DO UPDATE is atomic under the primary key, so concurrent callers
-- across instances increment the same row without a lost update. When the
-- stored window has elapsed the counter restarts at 1.
create or replace function public.rate_limit_hit(p_key text, p_window_ms bigint)
returns table (total_hits integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window interval := make_interval(secs => p_window_ms / 1000.0);
begin
  insert into public.rate_limit_counters (key, hits, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set hits = case
                 when public.rate_limit_counters.window_start < now() - v_window
                 then 1
                 else public.rate_limit_counters.hits + 1
               end,
        window_start = case
                 when public.rate_limit_counters.window_start < now() - v_window
                 then now()
                 else public.rate_limit_counters.window_start
               end
  returning public.rate_limit_counters.hits,
            public.rate_limit_counters.window_start + v_window
  into total_hits, reset_at;

  return next;
end;
$$;

-- Clear a single key (express-rate-limit resetKey), used e.g. to clear a login
-- lockout after a success.
create or replace function public.rate_limit_reset(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limit_counters where key = p_key;
$$;

revoke all on function public.rate_limit_hit(text, bigint) from public, anon, authenticated;
revoke all on function public.rate_limit_reset(text) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, bigint) to service_role;
grant execute on function public.rate_limit_reset(text) to service_role;
