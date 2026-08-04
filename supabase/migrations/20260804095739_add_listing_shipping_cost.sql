-- Seller-set postage on marketplace listings.
--
-- Until now only CardPop Shop items attracted a shipping fee at checkout —
-- marketplace listings always priced shipping at $0, so buyers saw
-- "Shipping: Free" on every card and sellers absorbed the postage cost.
-- This adds a per-listing postage price the seller sets on the Add/Edit Card
-- form (0 = free shipping, which keeps existing listings exactly as they are).
-- The amount is charged to the buyer at checkout and passed through to the
-- seller's payout untouched — no commission, no GST added on top (it is the
-- seller's own consumer-quoted price, not platform revenue).
alter table public.listings
  add column if not exists shipping_cost_aud numeric(10,2) not null default 0;

-- Sanity bounds: never negative, and capped well above any real AU postage
-- cost so a typo can't turn the postage line into a second asking price.
alter table public.listings
  drop constraint if exists listings_shipping_cost_aud_range;
alter table public.listings
  add constraint listings_shipping_cost_aud_range
  check (shipping_cost_aud >= 0 and shipping_cost_aud <= 200);
