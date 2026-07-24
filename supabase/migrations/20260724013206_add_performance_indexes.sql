-- Performance indexes for the hot public query paths, identified in
-- EFFICIENCY_AUDIT_2026-07-24.md. Supersedes the never-applied (and
-- wrongly-columned) sql/performance_indexes.sql, which is deleted in the
-- same commit. All DDL is idempotent.

create extension if not exists pg_trgm;

-- Marketplace grid (pages/marketplace/MarketplacePage.jsx): listings filtered
-- by status in ('active','sold') and sorted by created_at desc or price_aud,
-- paginated with a count over the same predicate.
create index if not exists idx_listings_status_created
  on public.listings (status, created_at desc);
create index if not exists idx_listings_status_price
  on public.listings (status, price_aud);

-- Category browse (pages/CategoryPage.jsx): leading-wildcard
-- ILIKE '%name%' on listings.category can only be served by a trigram index.
create index if not exists idx_listings_category_trgm
  on public.listings using gin (category gin_trgm_ops);

-- Shop category filtering (ShopCategoryPage / ShopCollectionPage):
-- same ILIKE pattern on shop_products.category.
create index if not exists idx_shop_products_category_trgm
  on public.shop_products using gin (category gin_trgm_ops);

-- Header unread-messages badge (components/Header.jsx): count of
-- recipient_id = uid AND read_at IS NULL on every authenticated page load.
-- Partial index keeps it tiny and index-only.
create index if not exists idx_messages_recipient_unread
  on public.messages (recipient_id)
  where read_at is null;

-- Conversation list + thread views (pages/MessagingPage.jsx): OR across
-- sender/recipient ordered by created_at desc, limit 200. One composite per
-- side lets the planner satisfy both arms and skip the sort.
create index if not exists idx_messages_recipient_created
  on public.messages (recipient_id, created_at desc);
create index if not exists idx_messages_sender_created
  on public.messages (sender_id, created_at desc);

-- Header pending-trades badge: responder_id = uid AND status = 'proposed'.
create index if not exists idx_trades_responder_status
  on public.trades (responder_id, status);

-- Homepage featured cards (pages/HomePage.jsx): admin-curated picks
-- (is_featured, newest first) and the public-recent backfill. Partial
-- indexes stay small; the listing_type <> 'Private' filter is residual.
create index if not exists idx_vault_items_featured_created
  on public.vault_items (created_at desc)
  where is_featured = true;
create index if not exists idx_vault_items_public_created
  on public.vault_items (created_at desc)
  where is_public = true;

-- Homepage featured sellers: is_featured_seller = true AND is_active = true,
-- limit 4. Tiny partial index makes it a cheap bitmap scan.
create index if not exists idx_profiles_featured_sellers
  on public.profiles (id)
  where is_featured_seller = true and is_active = true;

-- RLS hygiene: the shop_affiliate_products admin policy was the one policy
-- missed by 20260719071049_rls_initplan_wrap_auth_calls.sql — bare auth.uid()
-- is re-evaluated per row; (select auth.uid()) runs once per statement.
drop policy if exists "admin_manage_shop_affiliate_products" on public.shop_affiliate_products;
create policy "admin_manage_shop_affiliate_products"
  on public.shop_affiliate_products
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
      and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
      and profiles.is_admin = true
    )
  );
