-- Retention: the state the daily retention sweep needs
-- (src/services/retentionSweepService.js, docs/retention.md).
--
--   orders.marketing_consent      the checkout newsletter tick, recorded on the
--                                 order so an abandoned-checkout email is only
--                                 ever sent to someone who agreed to hear from us
--   orders.abandoned_email_sent_at  one reminder per abandoned checkout, ever
--   watchlist.price_at_add_aud    the price the buyer saw when they saved it —
--                                 a drop below this is worth an email
--   watchlist.last_alert_price_aud  the price last emailed about (no repeats)
--   watchlist.sold_alerted_at     "it sold" emailed once
--   saved_searches.last_alerted_at  new listings since this are a match digest
--   saved_searches.alerts_enabled  per-search opt-out
--   welcome_offers.reminder_sent_at  the "your code expires in a week" nudge
--   shop_restock_requests          "email me when it's back" on a sold-out shop
--                                 product; notified by the sweep once stock > 0

alter table public.orders add column if not exists marketing_consent boolean not null default false;
alter table public.orders add column if not exists abandoned_email_sent_at timestamptz;
create index if not exists orders_abandoned_candidates_idx
  on public.orders (created_at)
  where status in ('pending', 'cancelled') and abandoned_email_sent_at is null;

alter table public.watchlist add column if not exists price_at_add_aud numeric;
alter table public.watchlist add column if not exists last_alert_price_aud numeric;
alter table public.watchlist add column if not exists sold_alerted_at timestamptz;

alter table public.saved_searches add column if not exists last_alerted_at timestamptz;
alter table public.saved_searches add column if not exists alerts_enabled boolean not null default true;

alter table public.welcome_offers add column if not exists reminder_sent_at timestamptz;

create table if not exists public.shop_restock_requests (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.shop_products(id) on delete cascade,
  email       text not null,
  user_id     uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);
-- One open request per address per product; a new request after a restock
-- notification is allowed (the old row has notified_at set).
create unique index if not exists shop_restock_requests_open_uniq
  on public.shop_restock_requests (product_id, lower(email))
  where notified_at is null;
create index if not exists shop_restock_requests_pending_idx
  on public.shop_restock_requests (product_id)
  where notified_at is null;

-- Written and read only through the API (service role). No client policies.
alter table public.shop_restock_requests enable row level security;
