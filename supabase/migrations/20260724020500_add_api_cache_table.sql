-- Shared cross-instance cache for backend API results (eBay lookups, FX
-- rates, resolved card art). The backend previously cached these in process
-- memory, but on Vercel each serverless instance starts empty — so the
-- caches' TTLs were largely illusory and quota-limited upstreams (eBay,
-- card-art APIs) were re-hit per instance. See src/utils/sharedCache.js.
--
-- Service-role only: RLS is enabled with NO policies, so the anon/user keys
-- can't read or write it; the backend client bypasses RLS.

create table if not exists public.api_cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.api_cache enable row level security;

-- For opportunistic cleanup of expired rows.
create index if not exists idx_api_cache_expires
  on public.api_cache (expires_at);
