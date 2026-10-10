-- Indexes for the query shapes the browse pages actually issue, removal of the
-- indexes that duplicate another, and a narrower firing rule for the points
-- trigger. EFFICIENCY_AUDIT_2026-10-10.md §5.3–5.4.
--
-- Forward-looking: every hot table has tens of rows today and the planner
-- rightly sequential-scans them. These exist so the same pages stay fast when
-- the tables don't. Postgres 17 here: a two-value `status in (…)` on the
-- leading column of (status, created_at) cannot use the index's order, hence
-- the partial indexes. All idempotent; no CONCURRENTLY (db push runs each
-- migration in one transaction) — the tables are small enough for the locks
-- not to matter.

-- ── listings ────────────────────────────────────────────────────────────────
-- Seller store pages, "more from this seller", Account → Listings, the
-- prerender, and the monthly-quota trigger that counts a seller's listings on
-- every INSERT (20260802060100).
create index if not exists listings_seller_created_idx
  on public.listings (seller_id, created_at desc);
-- Product page, checkout, vault pages, the old RLS probe: "the listing(s) for
-- this card with this status".
create index if not exists listings_vault_item_status_idx
  on public.listings (vault_item_id, status);
-- Newest active+sold (search, collections, marketplace with sold shown).
create index if not exists listings_public_created_idx
  on public.listings (created_at desc)
  where status in ('active'::listing_status, 'sold'::listing_status);
-- "Just sold" strip.
create index if not exists listings_sold_updated_idx
  on public.listings (updated_at desc)
  where status = 'sold'::listing_status;
-- Prefixes of the composites above.
drop index if exists public.listings_seller_id_idx;
drop index if exists public.listings_vault_item_id_idx;
-- Prefix of idx_listings_status_created (status, created_at desc).
drop index if exists public.listings_status_idx;

-- ── vault_items ─────────────────────────────────────────────────────────────
-- Owner's vault, newest first (My Vault, Account → Vault, vault profile,
-- GET /vault).
create index if not exists vault_items_owner_created_idx
  on public.vault_items (owner_id, created_at desc);
drop index if exists public.vault_items_owner_id_idx;
-- Collection "Holy Grail" rails: highest-value public cards.
create index if not exists vault_items_public_value_idx
  on public.vault_items (estimated_value_aud desc)
  where is_public = true and estimated_value_aud > 0;
-- Marketplace free-text search ORs card_name, set_name AND card_number /
-- variant (src/utils/cardSearchFilter.js); without trigram indexes on the last
-- two the BitmapOr falls back to a scan for the whole OR.
create index if not exists vault_items_card_number_trgm_idx
  on public.vault_items using gin (card_number gin_trgm_ops);
create index if not exists vault_items_variant_trgm_idx
  on public.vault_items using gin (variant gin_trgm_ops);
-- Duplicates: identical to vault_items_card_name_idx / superseded by
-- idx_vault_items_featured_created.
drop index if exists public.idx_vault_items_card_name_trgm;
drop index if exists public.vault_items_is_featured_idx;

-- ── notifications ───────────────────────────────────────────────────────────
-- Dedupe lookups by the thing being notified about (order trigger,
-- pendingOrderAlertService).
create index if not exists notifications_related_type_idx
  on public.notifications (related_id, type)
  where related_id is not null;

-- ── orders ──────────────────────────────────────────────────────────────────
-- Buyer / seller order history, newest first; guest purchase-velocity by email;
-- the webhook's PaymentIntent lookup.
create index if not exists orders_buyer_created_idx
  on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_created_idx
  on public.orders (seller_id, created_at desc);
drop index if exists public.orders_buyer_id_idx;
drop index if exists public.orders_seller_id_idx;
create index if not exists orders_buyer_email_created_idx
  on public.orders (buyer_email, created_at desc)
  where buyer_email is not null;
create index if not exists orders_stripe_payment_intent_idx
  on public.orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- ── trades ──────────────────────────────────────────────────────────────────
-- Mirror of idx_trades_responder_status for the other side.
create index if not exists trades_initiator_status_idx
  on public.trades (initiator_id, status);
drop index if exists public.trades_initiator_id_idx;

-- ── events ──────────────────────────────────────────────────────────────────
-- Upcoming approved events (events page, map, related events, sitemap,
-- prerender); site search matches suburb as well as title.
create index if not exists events_approved_start_idx
  on public.events (start_date)
  where status = 'approved';
create index if not exists events_suburb_trgm_idx
  on public.events using gin (suburb gin_trgm_ops);

-- ── profiles ────────────────────────────────────────────────────────────────
-- Admin fan-out (`where is_admin`) runs from a dozen backend sites.
create index if not exists profiles_admins_idx
  on public.profiles (id)
  where is_admin = true;
-- Featured sellers: the existing idx_profiles_featured_sellers is partial on
-- is_featured_seller alone, so the homepage's OR with subscription_tier can't
-- use it.
create index if not exists profiles_featured_or_ultimate_rating_idx
  on public.profiles (rating desc nulls last)
  where is_active = true and (is_featured_seller = true or subscription_tier = 'ultimate');

-- ── card_catalogue ──────────────────────────────────────────────────────────
-- Catalogue lookups are `ilike '%name%'`.
create index if not exists card_catalogue_card_name_trgm_idx
  on public.card_catalogue using gin (card_name gin_trgm_ops);

-- ── exact duplicates / covered prefixes elsewhere ───────────────────────────
drop index if exists public.idx_whatnot_shows_user_id;          -- = whatnot_shows_user_id_idx
drop index if exists public.card_price_snapshots_card_date_idx; -- = unique (card_id, snapshot_date)
drop index if exists public.saved_searches_user_id_idx;         -- prefix of unique (user_id, params)
drop index if exists public.idx_shop_products_status;           -- prefix of idx_shop_products_status_created_at_id

-- ── award_points_on_order_completed fires on every orders UPDATE ────────────
-- The body only acts on a status change to 'completed', yet the trigger ran
-- for every column update (tracking numbers, shipped_at, delivered_at, …).
-- Scope it to the column it reads.
drop trigger if exists award_points_on_order_completed on public.orders;
create trigger award_points_on_order_completed
  after update of status on public.orders
  for each row execute function public.award_points_on_order_completed();
