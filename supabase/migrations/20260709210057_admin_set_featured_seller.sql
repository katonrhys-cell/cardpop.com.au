-- Let admins toggle a seller's "featured" flag from the admin portal.
--
-- Bug: pages/admin/SellersManagementPage.jsx flips is_featured_seller with the
-- anon Supabase client:
--   supabase.from('profiles').update({ is_featured_seller }).eq('id', sellerId)
-- where sellerId is ANOTHER user's row. The only UPDATE policy on
-- public.profiles is "Users can update their own profile"
-- (using (auth.uid() = id) — see 20260706202906_lock_profile_financial_columns),
-- so an admin acting on someone else's profile passes the RLS row filter to
-- 0 rows: the request "succeeds" with no error but changes nothing. The
-- homepage's `.eq('is_featured_seller', true)` query (HomePage.jsx) then finds
-- nothing, so featured sellers never appear despite the admin UI showing them.
--
-- Rather than granting admins a blanket UPDATE policy on profiles (which carries
-- sensitive columns — wallet_balance_aud, subscription_*, is_admin — that
-- 20260706202906 deliberately locks against browser edits), this exposes a
-- narrow SECURITY DEFINER RPC that can only touch is_featured_seller and only
-- when the caller is a verified admin. Blast radius stays a single boolean
-- column. Mirrors the repo's existing SECURITY DEFINER + pinned search_path +
-- explicit execute-grant pattern (accept_trade, can_sell, etc.).

create or replace function public.admin_set_featured_seller(target_id uuid, featured boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Authorize against the verified JWT, never a client-supplied argument.
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  ) then
    raise exception 'Only admins can set featured sellers'
      using errcode = '42501';
  end if;

  update public.profiles
  set is_featured_seller = featured
  where id = target_id;

  -- Report whether the target actually exists, so the client can distinguish a
  -- real update from a no-op (unlike the previous silent 0-row RLS failure).
  return found;
end;
$$;

-- Supabase's default privileges grant EXECUTE on new public functions to anon,
-- authenticated and service_role. Setting the featured flag always requires an
-- authenticated admin session, so anon never calls this — revoke it (also
-- clears Security Advisor lint 0028). The admin check inside the function is the
-- real gate for the authenticated role.
revoke execute on function public.admin_set_featured_seller(uuid, boolean) from anon;
