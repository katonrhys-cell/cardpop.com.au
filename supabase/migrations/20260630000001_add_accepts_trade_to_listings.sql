-- Add `accepts_trade` to listings.
--
-- Why: a "For Sale & Trade" listing is stored as listing_type = 'fixed' (so it
-- has a price), which made it indistinguishable from a sale-only listing — the
-- marketplace "For Trade" filter (listing_type = 'trade') never returned it.
-- This boolean lets a fixed-price listing also advertise that it's open to
-- trades, without overloading the listing_type enum that many queries depend on.
--
-- Pure "For Trade" listings (listing_type = 'trade') also set this true so the
-- filter can match a single column.
--
-- IMPORTANT: the application code that writes/reads this column ships in the
-- same change set — apply this migration BEFORE (or together with) that deploy,
-- or listing creation and the marketplace trade filter will error.

alter table public.listings
  add column if not exists accepts_trade boolean not null default false;

-- Backfill: existing trade listings accept trades.
update public.listings
  set accepts_trade = true
  where listing_type = 'trade'
    and accepts_trade is distinct from true;

-- Partial index to keep the marketplace trade filter fast.
create index if not exists idx_listings_accepts_trade
  on public.listings (accepts_trade)
  where accepts_trade = true;
