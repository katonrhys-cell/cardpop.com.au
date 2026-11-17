-- Minimal stand-in for `orders` — only what the order-numbers migration touches.
-- Used by tests/db/run-order-numbers-migration.sh only.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create type public.order_status as enum ('pending', 'payment_confirmed', 'shipped', 'completed', 'refunded');

create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  status       public.order_status not null default 'pending',
  seller_id    uuid,
  order_items  jsonb,
  total_aud    numeric not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- A trigger that must NOT fire when only order_number is backfilled (the real
-- ones — invoices, notifications, points — are all `update of status`).
create table public.status_trigger_log (order_id uuid, at timestamptz default now());
create function public.log_status_update() returns trigger language plpgsql as
$$ begin insert into public.status_trigger_log (order_id) values (new.id); return new; end $$;
create trigger trg_status_log after update of status on public.orders
  for each row execute function public.log_status_update();

-- Orders that exist before the migration, inserted deliberately OUT of creation
-- order (ids sort the opposite way to created_at) so a backfill that followed id
-- order — or insertion order — would number them wrongly.
insert into public.orders (id, created_at, status) values
  ('aaaaaaaa-0000-0000-0000-000000000003', '2026-03-03 10:00:00+00', 'completed'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '2026-02-02 10:00:00+00', 'refunded'),
  ('cccccccc-0000-0000-0000-000000000001', '2026-01-01 10:00:00+00', 'pending'),
  -- same instant as the next: the id breaks the tie
  ('dddddddd-0000-0000-0000-000000000005', '2026-04-04 10:00:00+00', 'shipped'),
  ('dddddddd-0000-0000-0000-000000000004', '2026-04-04 10:00:00+00', 'pending');

-- A direct (single-seller) sale and a two-seller cart, for seller_order_numbers().
insert into public.orders (id, created_at, seller_id, order_items) values
  ('eeee0000-0000-0000-0000-00000000000a', '2026-05-01 10:00:00+00', '11111111-1111-1111-1111-111111111111', null),
  ('eeee0000-0000-0000-0000-00000000000b', '2026-05-02 10:00:00+00', null,
   '[{"type":"listing","seller_id":"22222222-2222-2222-2222-222222222222"},
     {"type":"listing","seller_id":"33333333-3333-3333-3333-333333333333"},
     {"type":"shop","seller_id":"44444444-4444-4444-4444-444444444444"}]'::jsonb);
