-- Revoke EXECUTE on SECURITY DEFINER functions that don't need to be callable by
-- the anon / authenticated API roles, clearing Supabase Security Advisor lints
-- 0028 (anon) / 0029 (authenticated). A SECURITY DEFINER function callable by an
-- API role runs privileged code on request, so anything that isn't a deliberate
-- RPC should not be exposed.
--
-- Safe to revoke:
--  * The trigger functions (they return `trigger`): a trigger is fired by the
--    trigger mechanism under the table owner's context — the invoking role never
--    needs EXECUTE on the function — and PostgREST does not expose
--    trigger-returning functions as RPC endpoints at all. Revoking has no
--    functional effect; it only removes the flagged grant.
--  * first_banned_word(text): an internal helper called only from the (SECURITY
--    DEFINER) banned-word triggers, which invoke it in the owner's context. It is
--    NOT referenced by any RLS policy, so no policy evaluation needs it.
--
-- Deliberately LEFT executable (do not revoke):
--  * accept_trade(uuid,uuid) — a legitimate authenticated RPC (hardened to
--    derive the responder from auth.uid()); the app calls it directly.
--  * email_verification_ok() — used by the `listings_require_email_verified` RLS
--    policy on public.listings, which is evaluated as the authenticated role, so
--    it MUST keep EXECUTE or listing inserts would fail.
--  * admin_set_featured_seller(uuid,boolean) — the admin UI calls it as an
--    authenticated admin, and its own internal is_admin check is the real gate;
--    only the pointless anon grant is removed below.

revoke execute on function public.enforce_listing_approval() from anon, authenticated;
revoke execute on function public.flag_banned_words_listing() from anon, authenticated;
revoke execute on function public.flag_banned_words_review() from anon, authenticated;
revoke execute on function public.sync_vault_estimated_value_from_listing() from anon, authenticated;
revoke execute on function public.first_banned_word(text) from anon, authenticated;

revoke execute on function public.admin_set_featured_seller(uuid, boolean) from anon;
