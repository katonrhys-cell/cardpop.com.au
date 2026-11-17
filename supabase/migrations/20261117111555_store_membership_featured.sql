-- Featured card shops — an Ultimate membership perk.
--
-- A shop whose confirmed owner (local_game_stores.owner_id, 20261116221914)
-- holds the Ultimate membership is FEATURED in the directory: listed first in
-- its city with a Featured badge, for as long as the membership lasts. It is
-- the shop twin of the Ultimate Calendar Spotlight on events (20261116005126).
--
-- The flag is database-owned, like events.membership_featured:
--   * a BEFORE trigger on local_game_stores recomputes it on every write from
--     the owner's plan, so nobody — owner, admin or the API — sets it by hand;
--   * an AFTER trigger on profiles re-syncs a member's shops when their plan
--     (or admin flag) changes.
-- As with events, an admin's complimentary Ultimate never features a shop.
--
-- docs/store-pages.md → "Featured shops"

alter table public.local_game_stores
  add column if not exists membership_featured boolean not null default false;

comment on column public.local_game_stores.membership_featured is
  'True while the shop''s owner holds the Ultimate membership. Maintained by triggers — never set by hand.';

grant select (membership_featured) on public.local_game_stores to anon, authenticated;

-- Does this member's plan feature their shops? subscription_tier is only ever
-- 'ultimate' while the membership is entitled (the Stripe webhook drops it to
-- 'free' otherwise), so the tier alone is the test.
create or replace function public.store_membership_featured_applies(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_owner is not null and exists (
    select 1 from public.profiles p
     where p.id = p_owner
       and p.subscription_tier = 'ultimate'
       and coalesce(p.is_admin, false) = false
  );
$$;

revoke all on function public.store_membership_featured_applies(uuid) from public, anon, authenticated;

-- BEFORE INSERT / UPDATE on the shop. Named to run after
-- trg_local_game_stores_owner_guard (BEFORE triggers fire in name order),
-- which has already pinned owner_id for a member's own write.
create or replace function public.local_game_stores_set_membership_featured()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.membership_featured := public.store_membership_featured_applies(new.owner_id);
  return new;
end;
$$;

revoke all on function public.local_game_stores_set_membership_featured() from public, anon, authenticated;

drop trigger if exists trg_local_game_stores_zz_membership_featured on public.local_game_stores;
create trigger trg_local_game_stores_zz_membership_featured
  before insert or update on public.local_game_stores
  for each row execute function public.local_game_stores_set_membership_featured();

-- A member's plan (or admin flag) changed: re-sync the shops they own. The
-- update touches the flag only; the BEFORE trigger above settles its value.
create or replace function public.sync_store_membership_featured()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now boolean := new.subscription_tier = 'ultimate' and coalesce(new.is_admin, false) = false;
  v_was boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_was := old.subscription_tier = 'ultimate' and coalesce(old.is_admin, false) = false;
  end if;
  if coalesce(v_now, false) = coalesce(v_was, false) then
    return null;
  end if;

  update public.local_game_stores s
     set membership_featured = coalesce(v_now, false)
   where s.owner_id = new.id
     and s.membership_featured is distinct from coalesce(v_now, false);
  return null;
end;
$$;

revoke all on function public.sync_store_membership_featured() from public, anon, authenticated;

drop trigger if exists trg_sync_store_membership_featured on public.profiles;
create trigger trg_sync_store_membership_featured
  after insert or update of subscription_tier, is_admin on public.profiles
  for each row execute function public.sync_store_membership_featured();

-- Backfill: shops already owned by a (non-admin) Ultimate member.
update public.local_game_stores s
   set membership_featured = true
 where s.owner_id is not null
   and not s.membership_featured
   and public.store_membership_featured_applies(s.owner_id);
