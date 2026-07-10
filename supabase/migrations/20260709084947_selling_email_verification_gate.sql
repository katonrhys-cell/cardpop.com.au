-- Wire the `email_verification_required` platform setting on the SELLING side.
-- Buying is gated in the Express checkout routes; selling is a direct
-- client-side insert into public.listings, so the gate must be an RLS policy.
--
-- Implemented as a RESTRICTIVE policy so it ANDs with the existing permissive
-- listings_require_selling_entitlement policy (both must pass) rather than
-- widening access. Kept separate from can_sell() to avoid touching that
-- locked-down entitlement function.

-- True when either the platform doesn't require email verification, or the
-- current user's email is confirmed. SECURITY DEFINER to read platform_settings
-- and auth.users. Fails SAFE: a missing setting row → not required → allowed.
create or replace function public.email_verification_ok()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when coalesce(
      (select value = 'true'::jsonb or value = '"true"'::jsonb
         from public.platform_settings where key = 'email_verification_required'),
      false)
    then coalesce(
      (select email_confirmed_at is not null from auth.users where id = auth.uid()),
      false)
    else true
  end;
$$;

revoke execute on function public.email_verification_ok() from public;
revoke execute on function public.email_verification_ok() from anon;
grant  execute on function public.email_verification_ok() to authenticated;

drop policy if exists listings_require_email_verified on public.listings;
create policy listings_require_email_verified
  on public.listings
  as restrictive
  for insert
  to authenticated
  with check (public.email_verification_ok());
