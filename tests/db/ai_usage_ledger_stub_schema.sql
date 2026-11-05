-- Stand-ins for what the AI usage ledger migration expects to exist.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
alter role service_role bypassrls;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create table if not exists public.rate_limit_counters (key text primary key, window_start timestamptz not null default now());
insert into auth.users values ('11111111-1111-1111-1111-111111111111');
