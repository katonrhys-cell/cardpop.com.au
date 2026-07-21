-- Fix "infinite recursion detected in policy for relation vault_items".
--
-- 20260721064724_lock_vault_items_is_featured.sql locked the admin-curated
-- is_featured column against owner self-writes by pinning it in the
-- vault_items_update_access WITH CHECK to its stored value:
--
--   AND (NOT (is_featured IS DISTINCT FROM
--       ( SELECT v.is_featured FROM vault_items v WHERE (v.id = vault_items.id))))
--
-- That subquery reads vault_items from inside a policy attached to vault_items.
-- To plan it, Postgres must build the vault_items SELECT policy while it is
-- already building vault_items policies, which it rejects as infinite recursion.
-- Every UPDATE to a vault item then fails -- including admins managing a listing
-- from pages/admin/MarketplaceManagementPage.jsx (the reported symptom).
--
-- The pattern was copied from the profiles reputation lock
-- (20260720120200_lock_profile_reputation_columns.sql), which uses the same
-- self-subquery and works -- but ONLY because the profiles SELECT policy is
-- "Public profiles are viewable by everyone" USING (true), a trivially-true qual
-- that Postgres optimises away, so no vault_items-style re-entrancy occurs. The
-- vault_items SELECT policy (vault_items_select_access) is non-trivial -- it does
-- EXISTS (SELECT 1 FROM listings ...) -- so the self-reference genuinely recurses.
--
-- Fix: read the stored is_featured through a SECURITY DEFINER helper. A SECURITY
-- DEFINER function runs as its owner and bypasses RLS, so the policy no longer
-- references vault_items directly and the cycle is broken. The security intent is
-- unchanged: an owner UPDATE that changes is_featured still fails the pin; an
-- UPDATE that leaves it untouched still passes; admins satisfy the is_admin
-- branch and are unaffected. is_featured is a public, non-sensitive display flag,
-- so exposing a single-boolean lookup helper leaks nothing.

create or replace function public.vault_item_is_featured(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select is_featured from public.vault_items where id = p_id;
$$;

-- Restrict execution to the roles that evaluate the policy; the function is only
-- meant to back the WITH CHECK below, not to be called ad hoc.
revoke all on function public.vault_item_is_featured(uuid) from public;
grant execute on function public.vault_item_is_featured(uuid) to anon, authenticated, service_role;

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
      AND (NOT (is_featured IS DISTINCT FROM public.vault_item_is_featured(id)))
    )
  );
