-- Minimal stand-in for the production objects the shop_shipping_terms()
-- migration touches: the settings table and the API roles.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create table public.platform_settings (
  key text primary key,
  value jsonb,
  label text not null default '',
  group_name text,
  updated_at timestamptz default now()
);
alter table public.platform_settings enable row level security;
-- Admin-only in production; anon has no SELECT policy at all.
grant select on public.platform_settings to anon;

insert into public.platform_settings (key, value) values
  ('default_shipping_rate_aud', '15'::jsonb),
  ('free_shipping_threshold_aud', '"100"'::jsonb),
  ('encryption_secret_like', '"do-not-leak"'::jsonb);
