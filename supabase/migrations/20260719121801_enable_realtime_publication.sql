-- Enable Supabase Realtime for the tables the app subscribes to.
--
-- The frontend opens postgres_changes channels on ten public tables (inbox and
-- notification badges in Header, order/trade status on AccountDashboard, live
-- marketplace updates, admin events board, etc.), but the `supabase_realtime`
-- publication was empty — so none of those changes were ever delivered and the
-- UI has been limping along on manual refetch / optimistic-update fallbacks.
--
-- Add the subscribed tables to the publication so Realtime actually streams
-- their changes. Row-level security still applies: a subscriber only receives
-- changes for rows its JWT is allowed to SELECT, so no data is exposed that a
-- normal read wouldn't already return.
--
-- REPLICA IDENTITY FULL is set on the tables whose subscriptions filter on a
-- non-primary-key column (recipient_id, buyer_id, seller_id, owner_id,
-- user_id, initiator_id, responder_id, …). Without it a DELETE only carries the
-- primary key in its old row, so a non-PK filter can't match the delete and the
-- "row removed" event is silently dropped. The three tables filtered only on
-- the primary key (profiles, shop_products) or unfiltered (events) keep the
-- default replica identity, which already covers their cases.
--
-- Idempotent: publication membership is checked before each add, and setting
-- REPLICA IDENTITY FULL is a no-op when already full.

do $$
declare
  t text;
  tables text[] := array[
    'messages','notifications','orders','trades','watchlist','profiles',
    'listings','vault_items','shop_products','events'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Tables with non-PK subscription filters (or DELETE listeners on non-PK rows).
alter table public.messages      replica identity full;
alter table public.notifications replica identity full;
alter table public.orders        replica identity full;
alter table public.trades        replica identity full;
alter table public.watchlist     replica identity full;
alter table public.listings      replica identity full;
alter table public.vault_items   replica identity full;
