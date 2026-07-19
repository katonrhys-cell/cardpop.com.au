-- Add covering indexes for foreign keys that had none.
--
-- Supabase's performance advisor (lint 0001_unindexed_foreign_keys) flagged 45
-- foreign keys with no index on their referencing column(s). Without one,
-- Postgres must sequentially scan the child table to (a) satisfy joins that
-- filter on the FK column and (b) check/cascade on parent UPDATE/DELETE — which
-- gets progressively slower as the marketplace grows.
--
-- These are pure additive, idempotent (`if not exists`) and backward-compatible;
-- they change no query results, only their plans. One flagged FK
-- (`_managed_webhooks.fk_managed_webhooks_account`) is on a Supabase-managed
-- table outside the public schema and is intentionally left alone.
--
-- Index names follow idx_<table>_<column>.

create index if not exists idx_blog_articles_author_id on public.blog_articles (author_id);
create index if not exists idx_business_profiles_reviewed_by on public.business_profiles (reviewed_by);
create index if not exists idx_cards_wanted_category_id on public.cards_wanted (category_id);
create index if not exists idx_categories_parent_id on public.categories (parent_id);
create index if not exists idx_collection_section_cards_vault_item_id on public.collection_section_cards (vault_item_id);
create index if not exists idx_completed_sales_listing_id on public.completed_sales (listing_id);
create index if not exists idx_content_reports_reviewed_by on public.content_reports (reviewed_by);
create index if not exists idx_disputes_assigned_to on public.disputes (assigned_to);
create index if not exists idx_disputes_listing_id on public.disputes (listing_id);
create index if not exists idx_disputes_order_id on public.disputes (order_id);
create index if not exists idx_disputes_trade_id on public.disputes (trade_id);
create index if not exists idx_events_organiser_id on public.events (organiser_id);
create index if not exists idx_events_reviewed_by on public.events (reviewed_by);
create index if not exists idx_hero_showcase_cards_vault_item_id on public.hero_showcase_cards (vault_item_id);
create index if not exists idx_media_assets_uploaded_by on public.media_assets (uploaded_by);
create index if not exists idx_mfa_sessions_user_id on public.mfa_sessions (user_id);
create index if not exists idx_orders_commission_config_id on public.orders (commission_config_id);
create index if not exists idx_orders_offer_id on public.orders (offer_id);
create index if not exists idx_partners_local_game_store_id on public.partners (local_game_store_id);
create index if not exists idx_password_reset_tokens_user_id on public.password_reset_tokens (user_id);
create index if not exists idx_payment_disputes_buyer_id on public.payment_disputes (buyer_id);
create index if not exists idx_payment_disputes_resolved_by on public.payment_disputes (resolved_by);
create index if not exists idx_platform_settings_updated_by on public.platform_settings (updated_by);
create index if not exists idx_posts_vault_item_id on public.posts (vault_item_id);
create index if not exists idx_refunds_requested_by on public.refunds (requested_by);
create index if not exists idx_refunds_seller_id on public.refunds (seller_id);
create index if not exists idx_reviews_reviewer_id on public.reviews (reviewer_id);
create index if not exists idx_seller_ratings_reviewer_id on public.seller_ratings (reviewer_id);
create index if not exists idx_set_cards_parallel_id on public.set_cards (parallel_id);
create index if not exists idx_set_cards_subset_id on public.set_cards (subset_id);
create index if not exists idx_set_completion_set_card_id on public.set_completion (set_card_id);
create index if not exists idx_set_completion_vault_item_id on public.set_completion (vault_item_id);
create index if not exists idx_sets_manufacturer_id on public.sets (manufacturer_id);
create index if not exists idx_shop_products_created_by on public.shop_products (created_by);
create index if not exists idx_trades_initiator_listing_id on public.trades (initiator_listing_id);
create index if not exists idx_trades_responder_listing_id on public.trades (responder_listing_id);
create index if not exists idx_trades_topup_required_from on public.trades (topup_required_from);
create index if not exists idx_user_verifications_admin_id on public.user_verifications (admin_id);
create index if not exists idx_vault_items_franchise_id on public.vault_items (franchise_id);
create index if not exists idx_vault_items_manufacturer_id on public.vault_items (manufacturer_id);
create index if not exists idx_vault_items_parallel_id on public.vault_items (parallel_id);
create index if not exists idx_vault_items_set_id on public.vault_items (set_id);
create index if not exists idx_vault_items_subset_id on public.vault_items (subset_id);
create index if not exists idx_verification_audit_log_admin_id on public.verification_audit_log (admin_id);
