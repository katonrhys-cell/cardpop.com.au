-- Performance: wrap auth.<function>() calls in RLS policies with (select …).
--
-- Supabase's advisor (lint 0003_auth_rls_initplan) flagged 137 row-level
-- security policies that call auth.uid() / auth.role() directly. Postgres
-- re-evaluates such a call once PER ROW; wrapping it as (select auth.uid())
-- turns it into an InitPlan evaluated ONCE per query. Same result, same
-- security semantics — just far less work on any query that returns or scans
-- multiple rows.
--
-- Each statement below is an ALTER POLICY that replaces only the auth.*()
-- calls with their (select …) form; roles, command, permissive/restrictive
-- and every other predicate are untouched (the expressions were generated
-- from the live policy definitions via regexp_replace, so they round-trip
-- exactly). Re-running is safe: it just re-sets the same expression.
--
-- Generated from pg_policies on 2026-07-19; 137 policies across 63 tables.

alter policy ai_messages_select_own on public.ai_messages using (((select auth.uid()) = user_id));
alter policy users_own_audit_logs on public.audit_logs using (((select auth.uid()) = user_id));
alter policy "Authenticated users can place bids" on public.bids with check (((select auth.uid()) = bidder_id));
alter policy "Bids visible to listing seller and bidder" on public.bids using ((((select auth.uid()) = bidder_id) OR (EXISTS ( SELECT 1
   FROM listings
  WHERE ((listings.id = bids.listing_id) AND (listings.seller_id = (select auth.uid())))))));
alter policy admin_delete_articles on public.blog_articles using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy admin_insert_articles on public.blog_articles with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy admin_select_all_articles on public.blog_articles using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy admin_update_articles on public.blog_articles using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy admin_manage_business_affiliate_links on public.business_affiliate_links using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Users can create their own business profile" on public.business_profiles with check (((select auth.uid()) = user_id));
alter policy "Users can update their own business profile" on public.business_profiles using (((select auth.uid()) = user_id));
alter policy "Users can view their own business profile" on public.business_profiles using (((select auth.uid()) = user_id));
alter policy cmv_service_rw on public.card_market_valuations using (((select auth.role()) = 'service_role'::text)) with check (((select auth.role()) = 'service_role'::text));
alter policy cpr_service_rw on public.card_price_ranges using (((select auth.role()) = 'service_role'::text)) with check (((select auth.role()) = 'service_role'::text));
alter policy "Users can manage their own wanted cards" on public.cards_wanted using (((select auth.uid()) = user_id));
alter policy "Admins can manage categories" on public.categories using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Admins full access" on public.collection_eras using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy collection_section_cards_admin_all on public.collection_section_cards using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Authenticated users can view visible comments" on public.comments using ((((select auth.role()) = 'authenticated'::text) AND (is_visible = true)));
alter policy "Users can create comments" on public.comments with check (((select auth.uid()) = author_id));
alter policy "Users can delete their own comments" on public.comments using (((select auth.uid()) = author_id));
alter policy "Users can update their own comments" on public.comments using (((select auth.uid()) = author_id));
alter policy cs_own_sales on public.completed_sales using ((((select auth.uid()) = seller_id) OR ((select auth.uid()) = buyer_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))));
alter policy cs_service_insert on public.completed_sales with check (((select auth.role()) = 'service_role'::text));
alter policy "Reporters can read their own reports" on public.content_reports using (((select auth.uid()) = reporter_id));
alter policy "Service role manages reports" on public.content_reports using (((select auth.role()) = 'service_role'::text)) with check (((select auth.role()) = 'service_role'::text));
alter policy "Admins can update disputes" on public.disputes using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Admins can view all disputes" on public.disputes using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Authenticated users can file disputes" on public.disputes with check (((select auth.uid()) = reporter_id));
alter policy "Reporters can view their own disputes" on public.disputes using (((select auth.uid()) = reporter_id));
alter policy "Admins read all rsvps" on public.event_rsvps using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Users delete own rsvp" on public.event_rsvps using (((select auth.uid()) = user_id));
alter policy "Users insert own rsvp" on public.event_rsvps with check (((select auth.uid()) = user_id));
alter policy "Users read own rsvps" on public.event_rsvps using (((select auth.uid()) = user_id));
alter policy "Users update own rsvp" on public.event_rsvps using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "Authenticated users can submit events" on public.events with check ((((select auth.uid()) = organiser_id) AND (status = 'pending_review'::event_status)));
alter policy "Organisers can update pending events" on public.events using ((((select auth.uid()) = organiser_id) AND (status = 'pending_review'::event_status)));
alter policy "Organisers can view their own events" on public.events using (((select auth.uid()) = organiser_id));
alter policy admins_manage_events on public.events using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy admin_manage_grading_companies on public.grading_companies using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Allow service role to manage" on public.grading_verifications using (((select auth.role()) = 'service_role'::text));
alter policy hero_showcase_cards_admin_all on public.hero_showcase_cards using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Admins can delete all listings" on public.listings using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Admins can update all listings" on public.listings using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Admins can view all listings" on public.listings using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Sellers can insert listings" on public.listings with check (((select auth.uid()) = seller_id));
alter policy "Sellers can update their own non-sold listings" on public.listings using ((((select auth.uid()) = seller_id) AND (status <> 'sold'::listing_status))) with check (((select auth.uid()) = seller_id));
alter policy "Sellers can view all their own listings" on public.listings using (((select auth.uid()) = seller_id));
alter policy listings_require_selling_entitlement on public.listings with check (private.can_sell((select auth.uid())));
alter policy "Admins can delete stores" on public.local_game_stores using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Admins can read all stores" on public.local_game_stores using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Admins can update stores" on public.local_game_stores using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy login_attempts_service_only on public.login_attempts using (((select auth.role()) = 'service_role'::text)) with check (((select auth.role()) = 'service_role'::text));
alter policy "Admin manage manufacturers" on public.manufacturers using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy msl_service_rw on public.market_sold_listings using (((select auth.role()) = 'service_role'::text)) with check (((select auth.role()) = 'service_role'::text));
alter policy media_assets_admin_all on public.media_assets using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Admins can view all messages" on public.messages using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Authenticated users can send messages in context" on public.messages with check (((select auth.uid()) = sender_id));
alter policy "Message participants can view messages" on public.messages using ((((select auth.uid()) = sender_id) OR ((select auth.uid()) = recipient_id)));
alter policy "Recipients can update message read state" on public.messages using ((((select auth.uid()) = recipient_id) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))))) with check ((((select auth.uid()) = recipient_id) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))));
alter policy users_own_mfa_sessions on public.mfa_sessions using (((select auth.uid()) = user_id));
alter policy "Users manage own notification preferences" on public.notification_preferences using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "Users can mark their own notifications as read" on public.notifications using (((select auth.uid()) = user_id));
alter policy "Users can read their own notifications" on public.notifications using (((select auth.uid()) = user_id));
alter policy "Buyers can create offers" on public.offers with check (((select auth.uid()) = buyer_id));
alter policy "Buyers can respond to countered offers" on public.offers using ((((select auth.uid()) = buyer_id) AND (status = 'countered'::offer_status))) with check ((((select auth.uid()) = buyer_id) AND (status = ANY (ARRAY['accepted'::offer_status, 'declined'::offer_status]))));
alter policy "Buyers can withdraw their pending offers" on public.offers using ((((select auth.uid()) = buyer_id) AND (status = 'pending'::offer_status))) with check ((((select auth.uid()) = buyer_id) AND (status = 'withdrawn'::offer_status)));
alter policy "Offers visible to buyer and seller" on public.offers using ((((select auth.uid()) = buyer_id) OR ((select auth.uid()) = seller_id)));
alter policy "Sellers can respond to pending offers" on public.offers using ((((select auth.uid()) = seller_id) AND (status = 'pending'::offer_status))) with check ((((select auth.uid()) = seller_id) AND (status = ANY (ARRAY['accepted'::offer_status, 'declined'::offer_status, 'countered'::offer_status]))));
alter policy "Admins can update any order" on public.orders using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Admins can view all orders" on public.orders using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Orders visible to buyer and seller" on public.orders using ((((select auth.uid()) = buyer_id) OR ((select auth.uid()) = seller_id)));
alter policy "Admin manage parallels" on public.parallels using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Admins can read all referrals" on public.partner_referrals using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Partners can read own referrals" on public.partner_referrals using ((EXISTS ( SELECT 1
   FROM partners p
  WHERE ((p.id = partner_referrals.partner_id) AND (p.user_id = (select auth.uid()))))));
alter policy "Admins can read all partners" on public.partners using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Admins can update partners" on public.partners using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Partners can read own row" on public.partners using ((user_id = (select auth.uid())));
alter policy password_reset_tokens_service_only on public.password_reset_tokens using (((select auth.role()) = 'service_role'::text)) with check (((select auth.role()) = 'service_role'::text));
alter policy "Service role manages disputes" on public.payment_disputes using (((select auth.role()) = 'service_role'::text)) with check (((select auth.role()) = 'service_role'::text));
alter policy admins_manage_settings on public.platform_settings using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Authenticated users can view visible posts" on public.posts using ((((select auth.role()) = 'authenticated'::text) AND (is_visible = true)));
alter policy "Users can create posts" on public.posts with check (((select auth.uid()) = author_id));
alter policy "Users can delete their own posts" on public.posts using (((select auth.uid()) = author_id));
alter policy "Users can update their own posts" on public.posts using (((select auth.uid()) = author_id));
alter policy "Users can manage their own price alerts" on public.price_alerts using (((select auth.uid()) = user_id));
alter policy "Users can insert their own private profile data" on public.private_profile_data with check (((select auth.uid()) = user_id));
alter policy "Users can read their own private profile data" on public.private_profile_data using (((select auth.uid()) = user_id));
alter policy "Users can update their own private profile data" on public.private_profile_data using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "Admins can update any profile" on public.profiles using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Users can insert their own profile" on public.profiles with check (((select auth.uid()) = id));
alter policy "Users can update their own profile" on public.profiles using (((select auth.uid()) = id)) with check ((((select auth.uid()) = id) AND (NOT (is_admin IS DISTINCT FROM ( SELECT p.is_admin
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
  WHERE (p.id = (select auth.uid())))))));
alter policy "Authenticated users can view reactions" on public.reactions using (((select auth.role()) = 'authenticated'::text));
alter policy "Users can manage their own reactions" on public.reactions using (((select auth.uid()) = user_id));
alter policy admins_select_all_refunds on public.refunds using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy admins_update_refunds on public.refunds using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "buyers and sellers can view own refunds" on public.refunds using (((buyer_id = (select auth.uid())) OR (seller_id = (select auth.uid()))));
alter policy "buyers can insert refund requests" on public.refunds with check (((buyer_id = (select auth.uid())) AND (requested_by = (select auth.uid()))));
alter policy "Buyers can create reviews for their orders" on public.reviews with check (((select auth.uid()) = reviewer_id));
alter policy reviews_admin_all on public.reviews using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy reviews_insert_reviewer on public.reviews with check (((select auth.uid()) = reviewer_id));
alter policy reviews_select_visible on public.reviews using (((is_visible = true) OR (reviewer_id = (select auth.uid())) OR (seller_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true))))));
alter policy users_own_sec_alerts on public.security_alerts using (((select auth.uid()) = user_id));
alter policy "Authenticated users can create ratings" on public.seller_ratings with check (((select auth.uid()) = reviewer_id));
alter policy admins_write_tier_config on public.seller_tier_config using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Users can manage their own set completion" on public.set_completion using (((select auth.uid()) = user_id));
alter policy "Users can manage their own addresses" on public.shipping_addresses using (((select auth.uid()) = user_id));
alter policy shop_products_admin_delete on public.shop_products using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy shop_products_admin_insert on public.shop_products with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy shop_products_admin_read_all on public.shop_products using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy shop_products_admin_update on public.shop_products using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Admin manage subsets" on public.subsets using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Admin manage teams" on public.teams using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy "Authenticated users can propose trades" on public.trades with check (((select auth.uid()) = initiator_id));
alter policy "Participants can update trade status" on public.trades using ((((select auth.uid()) = responder_id) OR ((select auth.uid()) = initiator_id)));
alter policy "Trade participants can view their trades" on public.trades using ((((select auth.uid()) = initiator_id) OR ((select auth.uid()) = responder_id)));
alter policy "Admins can view all verifications" on public.user_verifications using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Users can submit their own verification" on public.user_verifications with check (((user_id = (select auth.uid())) AND (status = 'pending'::verification_status) AND (admin_id IS NULL) AND (admin_notes IS NULL) AND (additional_info_requested IS NULL) AND (id_extracted_name IS NULL) AND (name_match IS NULL) AND (name_match_confidence IS NULL) AND (reviewed_at IS NULL)));
alter policy "Users can view their own verifications" on public.user_verifications using ((user_id = (select auth.uid())));
alter policy admins_all_verifications on public.user_verifications using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy users_select_own_verification on public.user_verifications using (((select auth.uid()) = user_id));
alter policy "Users can manage images for their own vault items" on public.vault_images using ((EXISTS ( SELECT 1
   FROM vault_items
  WHERE ((vault_items.id = vault_images.vault_item_id) AND (vault_items.owner_id = (select auth.uid()))))));
alter policy "Admins can update all vault items" on public.vault_items using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy "Users can delete their own vault items" on public.vault_items using (((select auth.uid()) = owner_id));
alter policy "Users can insert into their own vault" on public.vault_items with check (((select auth.uid()) = owner_id));
alter policy "Users can update their own vault items" on public.vault_items using (((select auth.uid()) = owner_id));
alter policy "Users can view their own vault" on public.vault_items using (((select auth.uid()) = owner_id));
alter policy "Admins can view verification audit log" on public.verification_audit_log using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));
alter policy admins_all_audit on public.verification_audit_log using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
alter policy users_read_own_audit on public.verification_audit_log using ((EXISTS ( SELECT 1
   FROM user_verifications v
  WHERE ((v.id = verification_audit_log.verification_id) AND (v.user_id = (select auth.uid()))))));
alter policy "Users can manage their own watchlist" on public.watchlist using (((select auth.uid()) = user_id));
alter policy welcome_offers_select_own on public.welcome_offers using (((select auth.uid()) = user_id));
alter policy "Users can delete their own shows" on public.whatnot_shows using (((select auth.uid()) = user_id));
alter policy "Users can insert their own shows" on public.whatnot_shows with check (((select auth.uid()) = user_id));
alter policy "Users can update their own shows" on public.whatnot_shows using (((select auth.uid()) = user_id));
alter policy "Users can view their own shows" on public.whatnot_shows using (((select auth.uid()) = user_id));
alter policy "Users can manage their own wishlist" on public.wishlists using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
