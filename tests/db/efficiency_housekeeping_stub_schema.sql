-- Extra stand-ins for the efficiency housekeeping migration, applied after the
-- vault stub. Used by tests/db/run-efficiency-housekeeping-migration.sh only.
do $$ begin
  create role service_role nologin; exception when duplicate_object then null; end $$;

create type public.offer_status as enum ('pending', 'accepted', 'declined', 'countered', 'expired', 'withdrawn');
create table public.offers (
  id uuid primary key default uuid_generate_v4(),
  status public.offer_status not null default 'pending',
  expires_at timestamptz
);
create table public.card_price_snapshots (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid not null,
  snapshot_date date not null,
  unique (card_id, snapshot_date)
);
create table public.giveaway_entries (id uuid primary key default uuid_generate_v4(), user_id uuid, verified_by uuid);
create table public.giveaways (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid, drawn_by uuid,
  winner_entry_id uuid references public.giveaway_entries(id) on delete set null
);
