-- An offer is a way to buy a card, so it needs the same gate as checkout.
--
-- Sold listings are now visible across the whole site rather than disappearing
-- from it, which widens the window in which someone is looking at a sold card:
-- an open tab, a shared link, a search result. The UI hides "Make an Offer"
-- once a listing is sold (ProductDetailPage's canOffer), but the offers table
-- had no server-side equivalent — its INSERT policy only checked that the row
-- was being written by its own buyer. Money could never actually move (both
-- checkout paths refuse a listing that isn't active), but a seller could still
-- be notified of offers on a card they had already sold.
--
-- RESTRICTIVE, so it ANDs with "Buyers can create offers" rather than opening
-- a second way in. The sub-select reads `listings` under the buyer's own RLS,
-- which is fine: active listings are exactly the rows every visitor can read.
drop policy if exists "offers_require_active_listing" on public.offers;
create policy "offers_require_active_listing" on public.offers as restrictive for insert to authenticated
  with check (
    exists (
      select 1 from listings
      where listings.id = offers.listing_id
        and listings.status = 'active'::listing_status
    )
  );
