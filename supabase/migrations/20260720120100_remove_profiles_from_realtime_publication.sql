-- Remove public.profiles from the Realtime publication (sensitive-column leak).
--
-- 20260719121801_enable_realtime_publication.sql added `profiles` to the
-- `supabase_realtime` publication so AuthContext could keep the current user's
-- own row (and therefore isAdmin) fresh mid-session.
--
-- The problem: Supabase Realtime's postgres_changes enforces only ROW-level
-- RLS — it does NOT honour the column-level SELECT grants that
-- 20260715210000_restrict_profiles_sensitive_column_reads.sql relies on to hide
-- the six sensitive columns (wallet_balance_aud, stripe_customer_id,
-- stripe_subscription_id, paypal_subscription_id, stripe_identity_session_id,
-- legal_name). The row policy on profiles is "viewable by everyone"
-- (USING (true)), so ANY subscriber receives payload.new containing every
-- column. A client using the shipped anon key can subscribe with
-- `filter: id=eq.<any-user-uuid>` and harvest other users' wallet balances and
-- Stripe/PayPal identifiers as their rows change — re-opening exactly the leak
-- 20260715210000 was written to close.
--
-- There is no column-level Realtime, so the fix is to stop streaming profiles.
-- AuthContext's own-profile subscription simply stops receiving events and
-- falls back to its mount-time fetch (+ retry) — the only lost behaviour is a
-- mid-session admin demotion self-updating the chrome without a reload, an
-- acceptable trade for closing a financial-data leak.
--
-- Idempotent: only drop if currently a member.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime drop table public.profiles;
  end if;
end $$;
