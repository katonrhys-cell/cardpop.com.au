-- Card price tracking: powers the public /prices pages.
-- tracked_cards is the curated catalogue of cards we publish price pages for;
-- card_price_snapshots stores one aggregated AUD price observation per card per
-- day (built from live eBay AU/US listings by the backend refresh job), which
-- accumulates into the price-history series shown on each page.

create table if not exists public.tracked_cards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  set_name text,
  card_number text,
  category text not null check (category in ('pokemon', 'basketball', 'one-piece', 'afl', 'nrl')),
  search_query text not null,
  blurb text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tracked_cards_category_idx
  on public.tracked_cards (category) where active;

create table if not exists public.card_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.tracked_cards(id) on delete cascade,
  snapshot_date date not null default (now() at time zone 'utc')::date,
  -- Raw (ungraded) listings, AUD
  raw_avg numeric(12,2),
  raw_min numeric(12,2),
  raw_max numeric(12,2),
  raw_count integer not null default 0,
  -- Graded (PSA/BGS/CGC/SGC) listings, AUD
  graded_avg numeric(12,2),
  graded_min numeric(12,2),
  graded_max numeric(12,2),
  graded_count integer not null default 0,
  exchange_rate numeric(10,4),
  -- Up to ~6 representative live listings shown on the page:
  -- [{ title, priceAud, marketplace, condition, listingUrl, thumbnailUrl }]
  sample_listings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (card_id, snapshot_date)
);

create index if not exists card_price_snapshots_card_date_idx
  on public.card_price_snapshots (card_id, snapshot_date desc);

-- RLS: the pages are public, so anyone may read; all writes go through the
-- backend service-role client (bypasses RLS) — no client write policies.
alter table public.tracked_cards enable row level security;
alter table public.card_price_snapshots enable row level security;

drop policy if exists "Public can read active tracked cards" on public.tracked_cards;
create policy "Public can read active tracked cards"
  on public.tracked_cards for select
  using (active);

drop policy if exists "Public can read price snapshots" on public.card_price_snapshots;
create policy "Public can read price snapshots"
  on public.card_price_snapshots for select
  using (true);
