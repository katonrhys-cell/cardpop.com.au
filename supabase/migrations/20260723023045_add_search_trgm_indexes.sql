-- Trigram (pg_trgm) GIN indexes to accelerate the site-wide search's
-- `ILIKE '%term%'` queries (which otherwise can't use an index) and to enable
-- typo-tolerant similarity() matching as a follow-up. Idempotent.
--
-- NOTE: this migration was applied directly to the production database via the
-- Supabase connection (recorded as version 20260723023045) because the
-- supabase-migrations GitHub Action was unable to provision runners at the time.
-- The DDL is idempotent, so a later `supabase db push` reconciles cleanly.
create extension if not exists pg_trgm;

create index if not exists idx_vault_items_card_name_trgm
  on public.vault_items using gin (card_name gin_trgm_ops);
create index if not exists idx_vault_items_set_name_trgm
  on public.vault_items using gin (set_name gin_trgm_ops);

create index if not exists idx_shop_products_title_trgm
  on public.shop_products using gin (title gin_trgm_ops);

create index if not exists idx_blog_articles_title_trgm
  on public.blog_articles using gin (title gin_trgm_ops);
create index if not exists idx_blog_articles_excerpt_trgm
  on public.blog_articles using gin (excerpt gin_trgm_ops);

create index if not exists idx_events_title_trgm
  on public.events using gin (title gin_trgm_ops);

create index if not exists idx_profiles_display_name_trgm
  on public.profiles using gin (display_name gin_trgm_ops);
create index if not exists idx_profiles_username_trgm
  on public.profiles using gin (username gin_trgm_ops);
create index if not exists idx_profiles_business_name_trgm
  on public.profiles using gin (business_name gin_trgm_ops);
