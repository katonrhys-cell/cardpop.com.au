-- Broaden the featured-card public-read policy from (is_public AND is_featured)
-- to just (is_featured), so an admin featuring a card always makes it visible
-- to every visitor — even if the card's per-item is_public flag is false.
--
-- Context: 20260721214500_public_read_featured_vault_items.sql added a policy
-- exposing is_public = true AND is_featured = true. But admins feature cards
-- from Marketplace Management, and a card can be live in the marketplace (active
-- listing) while its vault item has is_public = false. Such a card, once
-- featured, saved fine but never appeared on the homepage (the homepage query
-- and this RLS policy both required is_public). The homepage query now keys the
-- featured grid off is_featured alone; align RLS so anon can actually read those
-- rows. `is_featured` is admin-only (locked by 20260721064724), so this only
-- exposes admin-curated cards and remains purely additive.

drop policy if exists "vault_items_public_featured_select" on public.vault_items;
create policy "vault_items_public_featured_select"
  on public.vault_items
  as permissive
  for select
  to public
  using (is_featured = true);

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
        and vi.is_featured = true
    )
  );
