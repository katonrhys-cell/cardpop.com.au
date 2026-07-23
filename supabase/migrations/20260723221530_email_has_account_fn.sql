-- Guest-checkout "you already have an account" nudge.
--
-- Lets the checkout email field tell a returning customer they already have a
-- CardPop account (and offer a sign-in link) without exposing the auth schema
-- to the browser. SECURITY DEFINER so it can read auth.users; execute is granted
-- ONLY to service_role (the Express backend), never the anon/authenticated
-- client keys — so it can't be turned into an open email-enumeration oracle from
-- the client. The backend endpoint that calls it is IP rate-limited on top.

create or replace function public.email_has_account(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(trim(check_email))
  );
$$;

-- Lock the function down: no ambient EXECUTE for public/anon/authenticated, only
-- the service role may call it.
revoke all on function public.email_has_account(text) from public;
revoke all on function public.email_has_account(text) from anon;
revoke all on function public.email_has_account(text) from authenticated;
grant execute on function public.email_has_account(text) to service_role;
