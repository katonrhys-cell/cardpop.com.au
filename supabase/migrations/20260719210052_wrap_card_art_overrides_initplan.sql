-- Performance: wrap auth.uid() in the card_art_overrides admin policy.
--
-- card_art_overrides was added after the advisor pass that the initplan
-- migration (20260719071049) fixed, so its admin policy reintroduced the same
-- auth_rls_initplan pattern — auth.uid() re-evaluated per row instead of once
-- per query. Wrap it as (select auth.uid()); identical semantics, InitPlan once.
--
-- Only the auth.uid() call changes; roles, command and predicate are untouched.
-- The overlapping public-read SELECT policy is intentionally left as-is (same
-- decision as the other admin-ALL + public-read tables): splitting it would add
-- policies for no runtime gain.

alter policy admin_manage_card_art_overrides on public.card_art_overrides
  using (
    (EXISTS ( SELECT 1
       FROM profiles
      WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))
  )
  with check (
    (EXISTS ( SELECT 1
       FROM profiles
      WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))
  );
