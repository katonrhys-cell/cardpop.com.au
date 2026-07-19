-- Performance: consolidate multiple permissive RLS policies into one per action.
--
-- Supabase advisor lint 0006_multiple_permissive_policies flagged tables that
-- have more than one PERMISSIVE policy for the same role+action. Postgres must
-- evaluate every such policy on every matching query. Because permissive
-- policies are OR'd together, N policies for one action can be replaced by a
-- single policy whose USING / WITH CHECK is the OR of the originals — identical
-- access, one policy to evaluate.
--
-- Scope: this migration handles only the "clean" groups — tables where the
-- overlapping policies are all single-command (SELECT/INSERT/UPDATE/DELETE),
-- so no ALL policy needs restructuring. The ~20 remaining groups that involve
-- an admin/service ALL policy are left for a separate, carefully-reviewed pass.
--
-- Notes:
--   * auth.<fn>() calls are wrapped as (select auth.<fn>()) to stay consistent
--     with the initplan migration regardless of apply order (no regression).
--   * Ordering: the initplan migration (20260719071049) ALTERs some of the
--     policies dropped here. Its earlier version number means db push always
--     applies it first, so merge that PR first. The drops are `if exists` so a
--     re-run or partial state can't wedge the migration.
--   * Where an admin policy targeted `authenticated` and the user/public policy
--     targeted `public`, the merged policy targets `public` (the role union).
--     This is equivalent: the admin predicate is auth-gated (EXISTS on
--     profiles.id = auth.uid()), so it can never match an anonymous request.
--   * WITH CHECK / USING are OR'd independently across the originals, which is
--     exactly how Postgres evaluates multiple permissive policies — so behaviour
--     is preserved. Verified: 18 groups, 38 policies replaced by 18, parens
--     balanced, no unwrapped auth calls.

-- blog_articles [SELECT]: merge 2 permissive policies
drop policy if exists "admin_select_all_articles" on public.blog_articles;
drop policy if exists "published_articles_are_public" on public.blog_articles;
create policy "blog_articles_select_access" on public.blog_articles as permissive for SELECT to public
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) or ((is_published = true)));

-- business_profiles [SELECT]: merge 2 permissive policies
drop policy if exists "Approved storefronts are publicly visible" on public.business_profiles;
drop policy if exists "Users can view their own business profile" on public.business_profiles;
create policy "business_profiles_select_access" on public.business_profiles as permissive for SELECT to public
  using (((storefront_status = 'approved'::storefront_status)) or (((select auth.uid()) = user_id)));

-- disputes [SELECT]: merge 2 permissive policies
drop policy if exists "Admins can view all disputes" on public.disputes;
drop policy if exists "Reporters can view their own disputes" on public.disputes;
create policy "disputes_select_access" on public.disputes as permissive for SELECT to public
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) or (((select auth.uid()) = reporter_id)));

-- event_rsvps [SELECT]: merge 2 permissive policies
drop policy if exists "Admins read all rsvps" on public.event_rsvps;
drop policy if exists "Users read own rsvps" on public.event_rsvps;
create policy "event_rsvps_select_access" on public.event_rsvps as permissive for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or (((select auth.uid()) = user_id)));

-- listings [SELECT]: merge 3 permissive policies
drop policy if exists "Active listings are publicly visible" on public.listings;
drop policy if exists "Admins can view all listings" on public.listings;
drop policy if exists "Sellers can view all their own listings" on public.listings;
create policy "listings_select_access" on public.listings as permissive for SELECT to public
  using (((status = 'active'::listing_status)) or ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) or (((select auth.uid()) = seller_id)));

-- listings [UPDATE]: merge 2 permissive policies (roles unified to public)
drop policy if exists "Admins can update all listings" on public.listings;
drop policy if exists "Sellers can update their own non-sold listings" on public.listings;
create policy "listings_update_access" on public.listings as permissive for UPDATE to public
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or ((((select auth.uid()) = seller_id) AND (status <> 'sold'::listing_status))))
  with check (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or (((select auth.uid()) = seller_id)));

-- local_game_stores [SELECT]: merge 2 permissive policies (roles unified to public)
drop policy if exists "Admins can read all stores" on public.local_game_stores;
drop policy if exists "Public can read approved stores" on public.local_game_stores;
create policy "local_game_stores_select_access" on public.local_game_stores as permissive for SELECT to public
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or ((status = 'approved'::text)));

-- messages [SELECT]: merge 2 permissive policies
drop policy if exists "Admins can view all messages" on public.messages;
drop policy if exists "Message participants can view messages" on public.messages;
create policy "messages_select_access" on public.messages as permissive for SELECT to public
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or ((((select auth.uid()) = sender_id) OR ((select auth.uid()) = recipient_id))));

-- offers [UPDATE]: merge 3 permissive policies
drop policy if exists "Buyers can respond to countered offers" on public.offers;
drop policy if exists "Buyers can withdraw their pending offers" on public.offers;
drop policy if exists "Sellers can respond to pending offers" on public.offers;
create policy "offers_update_access" on public.offers as permissive for UPDATE to public
  using (((((select auth.uid()) = buyer_id) AND (status = 'countered'::offer_status))) or ((((select auth.uid()) = buyer_id) AND (status = 'pending'::offer_status))) or ((((select auth.uid()) = seller_id) AND (status = 'pending'::offer_status))))
  with check (((((select auth.uid()) = buyer_id) AND (status = ANY (ARRAY['accepted'::offer_status, 'declined'::offer_status])))) or ((((select auth.uid()) = buyer_id) AND (status = 'withdrawn'::offer_status))) or ((((select auth.uid()) = seller_id) AND (status = ANY (ARRAY['accepted'::offer_status, 'declined'::offer_status, 'countered'::offer_status])))));

-- orders [SELECT]: merge 2 permissive policies
drop policy if exists "Admins can view all orders" on public.orders;
drop policy if exists "Orders visible to buyer and seller" on public.orders;
create policy "orders_select_access" on public.orders as permissive for SELECT to public
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) or ((((select auth.uid()) = buyer_id) OR ((select auth.uid()) = seller_id))));

-- partner_referrals [SELECT]: merge 2 permissive policies
drop policy if exists "Admins can read all referrals" on public.partner_referrals;
drop policy if exists "Partners can read own referrals" on public.partner_referrals;
create policy "partner_referrals_select_access" on public.partner_referrals as permissive for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or ((EXISTS ( SELECT 1
   FROM partners p
  WHERE ((p.id = partner_referrals.partner_id) AND (p.user_id = (select auth.uid())))))));

-- partners [SELECT]: merge 2 permissive policies
drop policy if exists "Admins can read all partners" on public.partners;
drop policy if exists "Partners can read own row" on public.partners;
create policy "partners_select_access" on public.partners as permissive for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or ((user_id = (select auth.uid()))));

-- profiles [UPDATE]: merge 2 permissive policies
drop policy if exists "Admins can update any profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "profiles_update_access" on public.profiles as permissive for UPDATE to public
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or (((select auth.uid()) = id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or ((((select auth.uid()) = id) AND (NOT (is_admin IS DISTINCT FROM ( SELECT p.is_admin
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (is_verified IS DISTINCT FROM ( SELECT p.is_verified
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (seller_tier IS DISTINCT FROM ( SELECT p.seller_tier
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (total_sales IS DISTINCT FROM ( SELECT p.total_sales
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (total_purchases IS DISTINCT FROM ( SELECT p.total_purchases
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (verification_status IS DISTINCT FROM ( SELECT p.verification_status
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (wallet_balance_aud IS DISTINCT FROM ( SELECT p.wallet_balance_aud
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (subscription_status IS DISTINCT FROM ( SELECT p.subscription_status
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (subscription_provider IS DISTINCT FROM ( SELECT p.subscription_provider
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (trial_ends_at IS DISTINCT FROM ( SELECT p.trial_ends_at
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (stripe_customer_id IS DISTINCT FROM ( SELECT p.stripe_customer_id
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (stripe_subscription_id IS DISTINCT FROM ( SELECT p.stripe_subscription_id
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (paypal_subscription_id IS DISTINCT FROM ( SELECT p.paypal_subscription_id
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (stripe_identity_session_id IS DISTINCT FROM ( SELECT p.stripe_identity_session_id
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (identity_name_mismatch IS DISTINCT FROM ( SELECT p.identity_name_mismatch
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) AND (NOT (payout_name_mismatch IS DISTINCT FROM ( SELECT p.payout_name_mismatch
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))))));

-- refunds [SELECT]: merge 2 permissive policies
drop policy if exists "admins_select_all_refunds" on public.refunds;
drop policy if exists "buyers and sellers can view own refunds" on public.refunds;
create policy "refunds_select_access" on public.refunds as permissive for SELECT to public
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) or (((buyer_id = (select auth.uid())) OR (seller_id = (select auth.uid())))));

-- shop_products [SELECT]: merge 2 permissive policies
drop policy if exists "shop_products_admin_read_all" on public.shop_products;
drop policy if exists "shop_products_public_read_active" on public.shop_products;
create policy "shop_products_select_access" on public.shop_products as permissive for SELECT to public
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or ((status = 'active'::text)));

-- vault_items [SELECT]: merge 2 permissive policies
drop policy if exists "Active listing vault items are publicly readable" on public.vault_items;
drop policy if exists "Users can view their own vault" on public.vault_items;
create policy "vault_items_select_access" on public.vault_items as permissive for SELECT to public
  using (((EXISTS ( SELECT 1
   FROM listings
  WHERE ((listings.vault_item_id = vault_items.id) AND (listings.status = 'active'::listing_status))))) or (((select auth.uid()) = owner_id)));

-- vault_items [UPDATE]: merge 2 permissive policies (roles unified to public)
drop policy if exists "Admins can update all vault items" on public.vault_items;
drop policy if exists "Users can update their own vault items" on public.vault_items;
create policy "vault_items_update_access" on public.vault_items as permissive for UPDATE to public
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or (((select auth.uid()) = owner_id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) or (((select auth.uid()) = owner_id)));

-- whatnot_shows [SELECT]: merge 2 permissive policies
drop policy if exists "Anyone can view active shows" on public.whatnot_shows;
drop policy if exists "Users can view their own shows" on public.whatnot_shows;
create policy "whatnot_shows_select_access" on public.whatnot_shows as permissive for SELECT to public
  using (((is_active = true)) or (((select auth.uid()) = user_id)));

