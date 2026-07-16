-- Follow-up to 20260715260000: actually remove anon/authenticated EXECUTE on the
-- flagged SECURITY DEFINER functions.
--
-- Postgres grants EXECUTE to PUBLIC by default when a function is created, so the
-- previous `revoke ... from anon, authenticated` was a no-op for the functions
-- that still carried that PUBLIC grant (anon/authenticated inherit EXECUTE via
-- PUBLIC). The effective fix is to revoke from PUBLIC. Verified against the live
-- ACLs: enforce_listing_approval / flag_banned_words_listing /
-- flag_banned_words_review / admin_set_featured_seller still hold `=X` (PUBLIC),
-- while first_banned_word and sync_vault_estimated_value_from_listing were
-- granted explicitly and are already clean (the statements below are harmless
-- no-ops for them).
--
-- Still safe (see 20260715260000 for the full rationale): the trigger functions
-- don't need the invoker's EXECUTE and aren't RPC-exposed; admin_set_featured_
-- seller keeps its explicit `authenticated` grant (the admin UI needs it, and its
-- internal is_admin check is the gate) — revoking PUBLIC only removes the anon
-- path. accept_trade and email_verification_ok are intentionally untouched.

revoke execute on function public.enforce_listing_approval() from public;
revoke execute on function public.flag_banned_words_listing() from public;
revoke execute on function public.flag_banned_words_review() from public;
revoke execute on function public.sync_vault_estimated_value_from_listing() from public;
revoke execute on function public.first_banned_word(text) from public;
revoke execute on function public.admin_set_featured_seller(uuid, boolean) from public;
