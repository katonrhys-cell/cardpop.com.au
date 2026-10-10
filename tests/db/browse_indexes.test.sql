-- Checks for 20261010020702_browse_indexes_and_trigger_scope.sql: every new
-- index exists, every duplicate is gone, nothing the planner still needs was
-- dropped without a replacement, and the points trigger only fires on status.
\set ON_ERROR_STOP on
do $$
declare n int; def text; oid_ uuid; buyer uuid := uuid_generate_v4(); seller uuid := uuid_generate_v4();
begin
  select count(*) into n from pg_indexes where schemaname = 'public' and indexname in (
    'listings_seller_created_idx','listings_vault_item_status_idx','listings_public_created_idx','listings_sold_updated_idx',
    'vault_items_owner_created_idx','vault_items_public_value_idx','vault_items_card_number_trgm_idx','vault_items_variant_trgm_idx',
    'notifications_related_type_idx','orders_buyer_created_idx','orders_seller_created_idx','orders_buyer_email_created_idx',
    'orders_stripe_payment_intent_idx','trades_initiator_status_idx','events_approved_start_idx','events_suburb_trgm_idx',
    'profiles_admins_idx','profiles_featured_or_ultimate_rating_idx','card_catalogue_card_name_trgm_idx');
  assert n = 19, 'all 19 new indexes present: ' || n;

  select count(*) into n from pg_indexes where schemaname = 'public' and indexname in (
    'listings_seller_id_idx','listings_vault_item_id_idx','listings_status_idx','vault_items_owner_id_idx',
    'orders_buyer_id_idx','orders_seller_id_idx','trades_initiator_id_idx','idx_whatnot_shows_user_id',
    'card_price_snapshots_card_date_idx','saved_searches_user_id_idx','idx_shop_products_status',
    'idx_vault_items_card_name_trgm','vault_items_is_featured_idx');
  assert n = 0, 'all 13 duplicate / prefix indexes dropped: ' || n;

  -- Every dropped prefix index still has a composite whose leading column is the same.
  assert exists (select 1 from pg_indexes where indexname = 'listings_seller_created_idx'), 'seller_id still indexed';
  assert exists (select 1 from pg_indexes where indexname = 'vault_items_card_name_idx'), 'card_name trigram kept';
  assert exists (select 1 from pg_indexes where indexname = 'whatnot_shows_user_id_idx'), 'whatnot user_id kept';
  assert exists (select 1 from pg_indexes where indexname = 'idx_shop_products_status_created_at_id'), 'shop status composite kept';

  -- The points trigger: a non-status update no longer fires it.
  select pg_get_triggerdef(t.oid) into def from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'orders' and t.tgname = 'award_points_on_order_completed';
  assert def like '%AFTER UPDATE OF status ON public.orders%', 'trigger scoped to status: ' || def;
  insert into public.orders (buyer_id, seller_id, status) values (buyer, seller, 'shipped') returning id into oid_;
  update public.orders set buyer_email = 'x@y.z' where id = oid_;
  select count(*) into n from public.points_log; assert n = 0, 'no points for a non-status update';
  update public.orders set status = 'completed' where id = oid_;
  select count(*) into n from public.points_log; assert n = 2, 'points awarded on completion: ' || n;
end $$;

select 'browse_indexes: ok' as result;
