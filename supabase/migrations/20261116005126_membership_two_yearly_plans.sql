-- Membership is now three plans: Hobby (free, always), Pro ($99 a year) and
-- Ultimate ($199 a year). Premium is folded into Pro and Elite into Ultimate
-- (config/plans.js, config/subscription.js). This is the database half:
--
--   1. profiles.subscription_tier accepts 'free' | 'pro' | 'ultimate' only;
--      any stored 'premium' becomes 'pro' and any 'elite' becomes 'ultimate'.
--   2. Monthly listing allowance: Hobby 5, Pro 30 (Premium's old allowance),
--      Ultimate unlimited. Mirrors LISTINGS_PER_MONTH in config/plans.js.
--   3. Listing Whatnot shows is a Pro-and-Ultimate perk (it was Premium-and-up,
--      and Pro absorbed Premium). Mirrors WHATNOT_SHOW_TIERS.
--   4. Ultimate is the show organisers' plan: every event an Ultimate member
--      runs gets Calendar Spotlight (events.is_featured) for as long as the
--      membership lasts. events.membership_featured records which events were
--      switched on by the membership, so that when it ends only those are
--      switched off again — an event an admin pinned, or one with its own paid
--      featuring (event_feature_purchases), keeps its placement.
--      Admins are excluded: their Ultimate is complimentary and they enter
--      most of the calendar on other organisers' behalf. Mirrors
--      hasEventSpotlight() in config/plans.js.
--
-- Idempotent. Test: tests/db/run-membership-plans-migration.sh.

-- ── 1. Two paid tiers ───────────────────────────────────────────────────────
update public.profiles set subscription_tier = 'pro'      where subscription_tier = 'premium';
update public.profiles set subscription_tier = 'ultimate' where subscription_tier = 'elite';

alter table public.profiles drop constraint if exists profiles_subscription_tier_check;
alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'pro', 'ultimate'));

-- ── 2. Monthly listing quota ────────────────────────────────────────────────
create or replace function public.enforce_monthly_listing_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_tier text;
  seller_is_admin boolean;
  quota integer;
  used integer;
begin
  select coalesce(p.subscription_tier, 'free'), coalesce(p.is_admin, false)
    into seller_tier, seller_is_admin
    from public.profiles p
   where p.id = new.seller_id;

  if seller_is_admin then
    return new;
  end if;

  quota := case seller_tier
    when 'pro'      then 30
    when 'ultimate' then null   -- unlimited
    else 5                      -- 'free' (Hobby) and anything unknown
  end;

  if quota is null then
    return new;
  end if;

  select count(*)::integer
    into used
    from public.listings l
   where l.seller_id = new.seller_id
     and l.created_at >= date_trunc('month', now());

  if used >= quota then
    raise exception 'LISTING_QUOTA_EXCEEDED: your plan allows % new listings per calendar month and you have used %. Upgrade your membership to list more this month.', quota, used
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_monthly_listing_quota() from public, anon;

-- ── 3. Whatnot shows: Pro and Ultimate ──────────────────────────────────────
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
          or p.subscription_tier in ('pro', 'ultimate')
        )
    )
  );

-- ── 4. Calendar Spotlight for Ultimate organisers ───────────────────────────
alter table public.events
  add column if not exists membership_featured boolean not null default false;

comment on column public.events.membership_featured is
  'True when is_featured was switched on by the organiser''s Ultimate membership (not by an admin or a paid featuring). Maintained by the membership spotlight triggers only; cleared, with is_featured, when the membership ends.';

create index if not exists events_membership_featured_idx
  on public.events (organiser_id)
  where membership_featured;

-- Does this organiser's plan feature their events? subscription_tier is only
-- ever 'ultimate' while the membership is entitled (the Stripe webhook drops
-- it to 'free' otherwise), so the tier alone is the test.
create or replace function public.membership_spotlight_applies(p_organiser uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = p_organiser
       and p.subscription_tier = 'ultimate'
       and coalesce(p.is_admin, false) = false
  );
$$;

revoke all on function public.membership_spotlight_applies(uuid) from public, anon, authenticated;

-- BEFORE INSERT / UPDATE on events. Runs after trg_guard_event_organiser_write
-- (BEFORE triggers fire in name order), which has already pinned is_featured
-- for a member's own write.
create or replace function public.apply_membership_event_spotlight()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_syncing boolean := coalesce(current_setting('cardpop.membership_spotlight_sync', true), '') = '1';
  v_admin   boolean := public.event_caller_is_admin();
begin
  -- The flag is bookkeeping, never a member's to write: clearing it on a
  -- spotlighted event would let the placement outlive the membership.
  if not v_syncing and v_admin is not distinct from false then
    if tg_op = 'INSERT' then
      new.membership_featured := false;
    else
      new.membership_featured := old.membership_featured;
    end if;
  end if;

  -- Decided when an event is created or changes hands; a membership starting
  -- or ending is handled by sync_membership_event_spotlight() on profiles.
  if not v_syncing and (tg_op = 'INSERT' or new.organiser_id is distinct from old.organiser_id) then
    if new.organiser_id is not null and public.membership_spotlight_applies(new.organiser_id) then
      if not coalesce(new.is_featured, false) then
        new.is_featured         := true;
        new.membership_featured := true;
      end if;
    elsif tg_op = 'UPDATE' and old.membership_featured then
      -- Handed to an organiser without the plan: the spotlight stays behind.
      new.membership_featured := false;
      new.is_featured := exists (
        select 1 from public.event_feature_purchases p
         where p.event_id = new.id and p.status = 'paid'
           and p.package in ('spotlight', 'spotlight_instagram', 'full')
      );
    else
      new.membership_featured := false;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.apply_membership_event_spotlight() from public, anon, authenticated;

drop trigger if exists trg_membership_event_spotlight on public.events;
create trigger trg_membership_event_spotlight
  before insert or update on public.events
  for each row execute function public.apply_membership_event_spotlight();

-- AFTER a profile's plan (or admin flag) changes: switch the spotlight on for
-- the new Ultimate organiser's events, or off again for the ones the
-- membership had switched on.
create or replace function public.sync_membership_event_spotlight()
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

  perform set_config('cardpop.membership_spotlight_sync', '1', true);
  if coalesce(v_now, false) then
    update public.events e
       set is_featured = true, membership_featured = true
     where e.organiser_id = new.id
       and not coalesce(e.is_featured, false);
  else
    update public.events e
       set membership_featured = false,
           is_featured = exists (
             select 1 from public.event_feature_purchases p
              where p.event_id = e.id and p.status = 'paid'
                and p.package in ('spotlight', 'spotlight_instagram', 'full')
           )
     where e.organiser_id = new.id
       and e.membership_featured;
  end if;
  perform set_config('cardpop.membership_spotlight_sync', '', true);

  return null;
end;
$$;

revoke all on function public.sync_membership_event_spotlight() from public, anon, authenticated;

-- Named to sort after trg_sync_admin_complimentary_membership's BEFORE work;
-- AFTER triggers see the row as that trigger left it either way.
drop trigger if exists trg_sync_membership_event_spotlight on public.profiles;
create trigger trg_sync_membership_event_spotlight
  after insert or update of subscription_tier, is_admin on public.profiles
  for each row execute function public.sync_membership_event_spotlight();

-- Backfill: events already owned by a (non-admin) Ultimate member.
do $$
begin
  perform set_config('cardpop.membership_spotlight_sync', '1', true);
  update public.events e
     set is_featured = true, membership_featured = true
    from public.profiles p
   where p.id = e.organiser_id
     and p.subscription_tier = 'ultimate'
     and coalesce(p.is_admin, false) = false
     and not coalesce(e.is_featured, false);
  perform set_config('cardpop.membership_spotlight_sync', '', true);
end $$;
