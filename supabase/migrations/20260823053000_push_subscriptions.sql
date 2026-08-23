-- Web-push subscriptions, one row per browser/device endpoint. All access
-- goes through the backend (/push routes + src/utils/pushService.js) with the
-- service-role client: RLS is enabled with NO policies on purpose, so the
-- anon/authenticated roles can neither read endpoints (they are capability
-- URLs — knowing one lets you spam that device) nor forge rows for others.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
