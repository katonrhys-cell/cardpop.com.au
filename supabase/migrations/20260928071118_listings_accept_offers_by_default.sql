-- Every buy-now listing takes offers by default.
--
-- "Make an Offer" used to show only on listings with accepts_offers = true,
-- and the only writer that ever set it true was the Expression of Interest
-- flow — the vault listing modal wrote false for every For Sale listing. So
-- in practice no fixed-price card could be offered on, even though the whole
-- accepted-offer checkout path (resolveOfferPrice) already worked for them.
--
-- Now offers sit alongside Buy Now on every fixed-price listing unless the
-- seller switches them off (Account → Listings → Accept Offers). New rows get
-- the flag from this column default — the listing writers only set it
-- explicitly for EOI — so a seller's opt-out survives re-saving the listing.
--
-- The backfill flips existing fixed-price listings on. The previous writers
-- stamped false on every sale listing, so a false today is almost always the
-- old default rather than a choice; sellers who want offers off can untick it.

alter table public.listings
  alter column accepts_offers set default true;

update public.listings
set accepts_offers = true
where listing_type = 'fixed'
  and status in ('active', 'draft')
  and accepts_offers is distinct from true;
