-- Lock the admin-curated vault_items.is_featured flag against owner self-writes.
--
-- SECURITY_AUDIT_2026-07-21.md → M8. `is_featured` (added by
-- 20260708150000_add_vault_items_is_featured.sql) controls which cards surface
-- in the homepage "Recent Vault Additions" / featured grid and is toggled ONLY
-- by admins via pages/admin/MarketplaceManagementPage.jsx. But the owner branch
-- of the current UPDATE policy (vault_items_update_access, last set in
-- 20260719113047_consolidate_multiple_permissive_policies.sql) pins no columns,
-- so with the shipped anon key any authenticated owner can run
--   supabase.from('vault_items').update({ is_featured: true }).eq('owner_id', self)
-- and jump their own cards onto the homepage, bypassing admin curation. This is
-- the same class of bug that 20260709210057 + 20260720120200 closed for
-- profiles.is_featured_seller — apply the parallel fix here.
--
-- Recreate the policy adding is_featured to the self-branch lock list (the same
-- "new value must equal the stored value" pattern the profiles locks use).
-- Admins are unaffected (they satisfy the is_admin branch); the admin toggle in
-- MarketplaceManagementPage keeps working. Legitimate owner edits to other
-- columns are unaffected because an UPDATE that leaves is_featured unchanged
-- still passes the pin.
drop policy if exists "vault_items_update_access" on public.vault_items;
create policy "vault_items_update_access" on public.vault_items as permissive for UPDATE to public
  using (
    (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))
    or ((select auth.uid()) = owner_id)
  )
  with check (
    (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))
    or (
      ((select auth.uid()) = owner_id)
      AND (NOT (is_featured IS DISTINCT FROM ( SELECT v.is_featured FROM vault_items v WHERE (v.id = vault_items.id))))
    )
  );
