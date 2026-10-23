-- Every admin holds the top membership tier (Ultimate) at no cost — as a
-- RULE, not a per-email list.
--
-- Until now the free top tier was granted account by account
-- (20260802062300, 20261004064733: the owner accounts and the platform
-- storefront login, keyed on auth email). An admin promoted through
-- Admin → Users → "Make Admin" was left on whatever plan they had — Hobby, or a
-- paid Stripe subscription that kept billing them. Admin access and
-- membership were documented as separate grants; the owner's decision is that
-- admin access INCLUDES the Ultimate plan, free.
--
-- How the grant is represented (unchanged shape, see docs/SUBSCRIPTION_SETUP.md
-- → Complimentary memberships):
--   subscription_tier   = 'ultimate'       the plan every gate reads
--   subscription_status = 'grandfathered'  entitled with NO provider
--                                          subscription behind it; no Stripe /
--                                          PayPal webhook ever emits it, and
--                                          applyStripeSubscription /
--                                          applyPaypalSubscription skip a
--                                          grandfathered profile, so nothing
--                                          external flips it back and nothing is
--                                          ever billed for it.
--
-- Enforcement is a BEFORE trigger on public.profiles, scoped to is_admin so it
-- costs nothing on the hot profile writes (last_seen, bio, avatar…):
--   * is_admin becomes true (insert or update)  → grant Ultimate / grandfathered.
--   * is_admin true → false                     → if the membership is the
--     complimentary one (status 'grandfathered'), revoke it: back to Hobby
--     ('free' / 'none'). A real paid subscription (trialing/active/past_due…)
--     is never touched — the ex-admin simply keeps paying for what they bought.
--   The trigger also re-asserts the grant whenever is_admin is written as true
--   again, so the rule self-heals if anything else drifted the columns.
--
-- What the database CANNOT do is cancel a Stripe subscription. The server side
-- of this rule lives in src/services/subscriptionService.js
-- (grantAdminComplimentaryMembership): the admin role route cancels any live
-- Stripe subscription the newly promoted admin was paying for before the
-- profile flips, and the paid checkout routes refuse to sell a plan to an
-- admin / complimentary member. If an EXISTING admin was mid-subscription when
-- this migration landed, the backfill below still grants Ultimate (the profile
-- then ignores provider events), but their Stripe subscription must be
-- cancelled by hand in the Stripe dashboard — check
--   select id, stripe_subscription_id from public.profiles
--    where is_admin and stripe_subscription_id is not null;
-- after applying.
--
-- The trigger is BEFORE so it rewrites NEW in place (one write, no recursion)
-- and runs regardless of who writes is_admin — the admin role route (service
-- role), an admin's own client-side update (RLS admin branch), or a migration.
-- SECURITY DEFINER is not needed: it only rewrites the row being written.
--
-- Idempotent: create or replace / drop if exists, and the backfill is keyed on
-- the columns being wrong.

create or replace function public.sync_admin_complimentary_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(new.is_admin, false) then
    -- Admin: the complimentary top tier, whatever was there before.
    if new.subscription_tier is distinct from 'ultimate'
       or new.subscription_status is distinct from 'grandfathered' then
      new.subscription_tier   := 'ultimate';
      new.subscription_status := 'grandfathered';
      new.trial_ends_at       := null;
      new.updated_at          := now();
    end if;
  elsif tg_op = 'UPDATE'
        and coalesce(old.is_admin, false)
        and new.subscription_status = 'grandfathered' then
    -- Demoted admin on the complimentary plan: the plan goes with the role.
    new.subscription_tier   := 'free';
    new.subscription_status := 'none';
    new.updated_at          := now();
  end if;
  return new;
end;
$$;

revoke all on function public.sync_admin_complimentary_membership() from public, anon;

drop trigger if exists trg_sync_admin_complimentary_membership on public.profiles;
create trigger trg_sync_admin_complimentary_membership
  before insert or update of is_admin on public.profiles
  for each row
  execute function public.sync_admin_complimentary_membership();

-- One-time backfill: every current admin onto the complimentary Ultimate plan.
-- (Writing is_admin to itself fires the trigger, which does the rewrite — the
-- SET list is spelled out anyway so the statement reads as what it does.)
update public.profiles
   set is_admin            = true,
       subscription_tier   = 'ultimate',
       subscription_status = 'grandfathered',
       trial_ends_at       = null,
       updated_at          = now()
 where is_admin = true
   and (subscription_tier is distinct from 'ultimate'
        or subscription_status is distinct from 'grandfathered');

-- Rollback (manual):
--   drop trigger if exists trg_sync_admin_complimentary_membership on public.profiles;
--   drop function if exists public.sync_admin_complimentary_membership();
