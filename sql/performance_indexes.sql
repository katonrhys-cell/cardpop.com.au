-- Database indexes for homepage and marketplace performance
-- Apply these via Supabase dashboard or CLI to optimize query execution

-- Featured cards on homepage (most critical)
CREATE INDEX idx_vault_items_public_active_created
  ON vault_items(is_public, listing_type, created_at DESC)
  WHERE is_public = true AND listing_type != 'Private';

-- Featured sellers on homepage
CREATE INDEX idx_profiles_featured_active
  ON profiles(is_featured_seller, is_active);

-- Marketplace filtering (category, condition, price range)
CREATE INDEX idx_vault_items_category_condition_price
  ON vault_items(category_id, condition, price)
  WHERE is_public = true;

-- Search across listings
CREATE INDEX idx_vault_items_search_title_artist
  ON vault_items USING GIN(to_tsvector('english', title || ' ' || artist));

-- Seller reputation and ratings
CREATE INDEX idx_profiles_rating_reviews
  ON profiles(rating DESC, reviews_count DESC);

-- Vault security queries
CREATE INDEX idx_vault_items_owner_private
  ON vault_items(owner_id, listing_type)
  WHERE listing_type = 'Private';

-- Performance test queries (run EXPLAIN ANALYZE on these)
-- 1. Homepage featured cards (should use idx_vault_items_public_active_created)
EXPLAIN ANALYZE
SELECT
  vi.*,
  p.id, p.display_name, p.username, p.avatar_url, p.is_verified, p.seller_tier, p.rating, p.reviews_count,
  COALESCE(json_agg(json_build_object('id', vim.id, 'image_url', vim.image_url)) FILTER (WHERE vim.id IS NOT NULL), '[]') as vault_images
FROM vault_items vi
LEFT JOIN profiles p ON vi.owner_id = p.id
LEFT JOIN vault_images vim ON vi.id = vim.vault_item_id
WHERE vi.is_public = true AND vi.listing_type != 'Private'
GROUP BY vi.id, p.id
ORDER BY vi.created_at DESC
LIMIT 4;

-- 2. Featured sellers (should use idx_profiles_featured_active)
EXPLAIN ANALYZE
SELECT * FROM profiles
WHERE is_featured_seller = true AND is_active = true
LIMIT 4;

-- 3. Marketplace filter by category and condition
EXPLAIN ANALYZE
SELECT id, title, price, condition
FROM vault_items
WHERE category_id = 1 AND condition = 'Near Mint' AND is_public = true
ORDER BY created_at DESC
LIMIT 20;

-- 4. Search query (should use GIN index)
EXPLAIN ANALYZE
SELECT id, title, artist, price
FROM vault_items
WHERE to_tsvector('english', title || ' ' || artist) @@ to_tsquery('english', 'charizard')
LIMIT 20;

-- Notes:
-- - Indexes are created with WHERE clauses to only index public listings (saves space)
-- - GIN index on full-text search enables fast text search across title+artist
-- - Composite indexes cover multi-column filters (category + condition + price)
-- - EXPLAIN ANALYZE shows actual query execution time and index usage
-- - Monitor index performance in Supabase dashboard: Inspect → Performance Advisor
