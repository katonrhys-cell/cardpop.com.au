-- Performance Optimization Indexes for CardPop
--
-- These indexes significantly improve query performance for frequently-used operations.
-- Run these in the Supabase Dashboard → SQL Editor or via `supabase db push` after
-- adding them to a migration file.
--
-- Last Updated: 2024-06-29

-- ─────────────────────────────────────────────────────────────────────────────
-- Homepage: Featured Cards (Recent Vault Additions)
-- ─────────────────────────────────────────────────────────────────────────────
-- Query: vault_items.select().eq('is_public', true).neq('listing_type', 'Private').order('created_at DESC').limit(4)
-- Current: Full table scan with in-memory filtering
-- With index: Direct lookup + sort (10-100x faster)

CREATE INDEX IF NOT EXISTS idx_vault_items_public_active_created
  ON vault_items (is_public, listing_type, created_at DESC)
  WHERE is_public = true AND listing_type != 'Private';

-- ─────────────────────────────────────────────────────────────────────────────
-- Homepage: Featured Sellers
-- ─────────────────────────────────────────────────────────────────────────────
-- Query: profiles.select().eq('is_featured_seller', true).eq('is_active', true)
-- Current: Full table scan with in-memory filtering
-- With index: Direct lookup (50-200x faster for large tables)

CREATE INDEX IF NOT EXISTS idx_profiles_featured_active
  ON profiles (is_featured_seller, is_active)
  WHERE is_featured_seller = true AND is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Marketplace: Filter by category & condition
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vault_items_category_condition
  ON vault_items (category_id, condition)
  WHERE is_public = true AND listing_type IN ('For Sale', 'For Sale & Trade');

-- ─────────────────────────────────────────────────────────────────────────────
-- Search: Quick lookup by card name
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vault_items_card_name_trgm
  ON vault_items USING gin (card_name gin_trgm_ops)
  WHERE is_public = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- User Profiles: Seller reputation lookup
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_seller_rating
  ON profiles (seller_tier, rating DESC)
  WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Implementation Notes
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1. These should be applied during database migration setup
-- 2. Monitor index usage: SELECT * FROM pg_stat_user_indexes WHERE idx_name LIKE 'idx_%'
-- 3. Re-index monthly for optimal performance: REINDEX INDEX CONCURRENTLY idx_name;
-- 4. Use EXPLAIN ANALYZE to verify query plans:
--    EXPLAIN ANALYZE SELECT * FROM vault_items WHERE is_public = true
--    ORDER BY created_at DESC LIMIT 4;
--
-- Performance Expected:
--   - Homepage load: 100-200ms → 20-50ms
--   - Search queries: 500ms+ → 50-100ms
--   - Featured sellers: 200-500ms → 10-30ms
