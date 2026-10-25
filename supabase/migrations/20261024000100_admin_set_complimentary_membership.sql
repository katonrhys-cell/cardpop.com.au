-- Let admins grant / remove a COMPLIMENTARY Ultimate membership from the admin
-- portal (Admin -> Sellers Management), like a 100%-off code they can switch on
-- and off.
--
-- A complimentary membership is subscription_tier 'ultimate' +
-- subscription_status 'grandfathered' with no Stripe/PayPal subscription behind
-- it (see COMPLIMENTARY_STATUS in src/services/subscriptionService.js): no
-- provider ever emits that status, and both apply* webhook helpers leave a
-- grandfathered profile alone, so nothing external flips it back.
-- subscription_* is locked against browser writes, so this is a narrow
-- SECURITY DEFINER RPC (same shape as admin_set_featured_seller) that can only
-- touch those two columns and only for a verified admin.
--
-- Guards:
--   * granting never overwrites a REAL paid/trialing subscription - that member
--     is already entitled and a provider webhook owns their state;
--   * removing only reverts a grandfathered row, so it can never cancel a
--     genuine paid membership, and the admin/owner accounts (permanently
--     grandfathered by 20260802062300 / 20261004064733) can't be removed.
--
-- Returns the resulting subscription_status ('grandfathered' | 'none'), or
-- null when nothing changed (unknown user, or a real subscription / protected
-- admin account blocked the change).

create or replace function public.admin_set_complimentary_membership(target_id uuid, enabled boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_status text;
  cur_admin  boolean;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  ) then
    raise exception 'Only admins can change complimentary memberships'
      using errcode = '42501';
  end if;

  select subscription_status, is_admin into cur_status, cur_admin
    from public.profiles where id = target_id;
  if not found then
    return null;
  end if;

  if enabled then
    if cur_status in ('active', 'trialing') then
      return null;
    end if;
    update public.profiles
       set subscription_tier   = 'ultimate',
           subscription_status = 'grandfathered'
     where id = target_id;
    return 'grandfathered';
  end if;

  if cur_status is distinct from 'grandfathered' or cur_admin then
    return null;
  end if;
  update public.profiles
     set subscription_tier   = 'free',
         subscription_status = 'none'
   where id = target_id;
  return 'none';
end;
$$;

revoke execute on function public.admin_set_complimentary_membership(uuid, boolean) from public;
revoke execute on function public.admin_set_complimentary_membership(uuid, boolean) from anon;
grant  execute on function public.admin_set_complimentary_membership(uuid, boolean) to authenticated;
