-- Listing Whatnot live shows becomes a Premium-and-up membership perk.
--
-- The Whatnot directory (pages/community/WhatnotShowsPage.jsx) is written by
-- direct client-side inserts into public.whatnot_shows, so the gate must live
-- in the INSERT policy — UI gating alone is trivially bypassable with the
-- shipped anon key. config/plans.js `canListWhatnotShows` /
-- `WHATNOT_SHOW_TIERS` is the app-side mirror of the tier list here — keep the
-- two in sync.
--
-- Rules:
--   * INSERT: owner must be Premium, Elite or Ultimate (or an admin).
--     subscription_tier is trustworthy — it is service-role-written only
--     (pinned by 20260802060200_lock_profiles_subscription_tier.sql).
--   * Existing rows are grandfathered: SELECT/UPDATE/DELETE policies are
--     untouched, so a member who listed shows before this gate (or whose
--     membership lapsed) can still see, unlist or delete them — they just
--     can't create new ones until they upgrade.
drop policy if exists "whatnot_shows_insert_access" on public.whatnot_shows;
create policy "whatnot_shows_insert_access" on public.whatnot_shows
  as permissive for insert to public
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and (
          p.is_admin = true
          or p.subscription_tier in ('premium', 'elite', 'ultimate')
        )
    )
  );
