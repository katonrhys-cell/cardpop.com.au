-- Guarantee homepage-featured cards are visible to EVERY visitor (incl. logged-out).
--
-- The homepage "Featured Cards" grid reads `vault_items` with the shipped anon
-- key, so it is subject to RLS. The existing SELECT policy
-- (`vault_items_select_access`, from
-- 20260719113047_consolidate_multiple_permissive_policies.sql) gates public
-- visibility on the item having an ACTIVE LISTING:
--     EXISTS (listings where vault_item_id = id AND status = 'active')
--       OR auth.uid() = owner_id
-- That couples "is this card publicly visible" to listing status, not to the
-- admin-curated `is_featured` flag. So a card an admin features but that has no
-- active listing (never listed, or its listing sold / went inactive) silently
-- disappears for anonymous and non-owner visitors, while its OWNER still sees it
-- (the auth.uid() branch) — i.e. "works for me, blank for everyone else".
--
-- `is_featured` is admin-only: owners cannot set it (locked by
-- 20260721064724_lock_vault_items_is_featured.sql), so it is a trustworthy
-- signal that a card is meant to be shown publicly. Add a PURELY ADDITIVE
-- permissive SELECT policy: Postgres OR-combines permissive policies for the
-- same command, so this only WIDENS visibility for admin-curated, public,
-- featured cards and changes nothing else.

drop policy if exists "vault_items_public_featured_select" on public.vault_items;
create policy "vault_items_public_featured_select"
  on public.vault_items
  as permissive
  for select
  to public
  using (is_public = true and is_featured = true);

-- Matching policy for their images. `vault_images` are only publicly readable
-- when the parent item has an active listing (from
-- 20260709... "Vault images for active listings are publicly readable"), so a
-- featured-but-unlisted card would render with broken art even once the row
-- above is visible. Mirror the featured allowance here so featured cards always
-- show their photos too.
drop policy if exists "vault_images_public_featured_select" on public.vault_images;
create policy "vault_images_public_featured_select"
  on public.vault_images
  as permissive
  for select
  to public
  using (
    exists (
      select 1 from public.vault_items vi
      where vi.id = vault_images.vault_item_id
        and vi.is_public = true
        and vi.is_featured = true
    )
  );
