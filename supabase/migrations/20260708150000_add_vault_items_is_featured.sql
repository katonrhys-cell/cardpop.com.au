-- Curatable "featured" flag for the homepage card grid.
--
-- The homepage "Recent Vault Additions" section reads straight from
-- `vault_items` (the 4 most recent public, non-Private cards). This adds an
-- explicit `is_featured` flag so an admin can hand-pick which cards surface
-- there. The homepage prefers featured cards and backfills with recent ones,
-- so an empty selection keeps the previous behaviour.
--
-- The admin toggle lives on the Marketplace Management page, which operates on
-- `listings`; each listing references a `vault_items` row via `vault_item_id`,
-- and the toggle writes the flag onto that vault item. The frontend admin pages
-- use the anon key (subject to RLS), so an admin UPDATE policy is required —
-- mirroring the existing "Admins can update all listings" policy. The backend
-- service_role key bypasses RLS and is unaffected.

alter table public.vault_items
  add column if not exists is_featured boolean not null default false;

-- Partial index: the homepage query filters on is_featured = true.
create index if not exists vault_items_is_featured_idx
  on public.vault_items (is_featured)
  where is_featured = true;

drop policy if exists "Admins can update all vault items" on public.vault_items;
create policy "Admins can update all vault items"
  on public.vault_items
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
