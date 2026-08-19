-- Sold listings must stay publicly readable.
--
-- The app has shown sold cards on the marketplace since Aug 2026 — badged
-- "Sold", price struck through, buy action disabled (MarketplacePage fetches
-- `.in('status', ['active','sold'])`, MarketplaceListingCard renders the Sold
-- overlay, ProductDetailPage renders the sold detail page and redirects vault
-- URLs onto it). None of that ever reached a visitor: the SELECT policies
-- consolidated in 20260719113047 predate the feature and expose a listing to
-- the public only while `status = 'active'`.
--
-- The effect was invisible to the people who could have spotted it — a seller
-- and an admin both match the other legs of the policy, so their own sold
-- cards looked right — while every logged-out visitor either lost the card
-- entirely or fell through to a stale "For Sale" vault view of a card that had
-- already sold.
--
-- Three policies have to move together, because the marketplace grid and the
-- listing detail page read the vault row (and its photos) through an INNER
-- embed: widening `listings` alone would still drop the row on the join.
-- Archived stays private — that remains the way to take a card off the site.

-- listings: publish active + sold; admins and the seller keep full visibility.
drop policy if exists "listings_select_access" on public.listings;
create policy "listings_select_access" on public.listings as permissive for select to public
  using (
    (status in ('active'::listing_status, 'sold'::listing_status))
    or (exists (
      select 1 from profiles
      where profiles.id = (select auth.uid()) and profiles.is_admin = true
    ))
    or ((select auth.uid()) = seller_id)
  );

-- vault_items: the card behind a sold listing stays readable.
drop policy if exists "vault_items_select_access" on public.vault_items;
create policy "vault_items_select_access" on public.vault_items as permissive for select to public
  using (
    (exists (
      select 1 from listings
      where listings.vault_item_id = vault_items.id
        and listings.status in ('active'::listing_status, 'sold'::listing_status)
    ))
    or ((select auth.uid()) = owner_id)
  );

-- vault_images: same, so a sold card keeps its photos instead of rendering
-- "No images available".
drop policy if exists "Vault images for active listings are publicly readable" on public.vault_images;
drop policy if exists "vault_images_public_listing_select" on public.vault_images;
create policy "vault_images_public_listing_select" on public.vault_images as permissive for select to public
  using (
    exists (
      select 1 from listings
      where listings.vault_item_id = vault_images.vault_item_id
        and listings.status in ('active'::listing_status, 'sold'::listing_status)
    )
  );
