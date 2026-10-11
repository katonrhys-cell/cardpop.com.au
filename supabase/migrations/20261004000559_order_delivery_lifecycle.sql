-- Order delivery lifecycle.
--
-- Until now an order could be marked shipped only by an admin, and nothing
-- ever recorded delivery — so marketplace buyers never got a shipped email,
-- the 7-days-from-delivery Buyer Protection window had no start, and sellers
-- had no way to see where to post a card (the seller_sales() function
-- deliberately withholds the whole orders row, which also holds the buyer's
-- address).
--
-- This migration:
--   1. adds delivered_at / delivery_source / delivery_notified_at to orders
--      (delivered_at is what utils/buyerProtectionPolicy.js reads);
--   2. rebuilds seller_sales() with the shipping state a seller needs to act
--      (shipped_at, carrier, tracking, delivered_at, buyer display name) —
--      still never the address;
--   3. adds seller_sale_shipping(order_id): the buyer's delivery address for
--      ONE sale, returned only to the seller of that order (or of a line in a
--      cart order). SECURITY DEFINER with its own ownership check, so a
--      per-line seller still can't read the rest of the cart.

alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists delivery_source text
  check (delivery_source is null or delivery_source in ('carrier', 'buyer', 'auto', 'admin'));
alter table public.orders add column if not exists delivery_notified_at timestamptz;

create index if not exists orders_shipped_undelivered_idx
  on public.orders (shipped_at)
  where status = 'shipped' and delivered_at is null;

-- seller_sales_summary() depends on seller_sales(); changing a function's
-- return type requires dropping both first.
drop function if exists public.seller_sales_summary();
drop function if exists public.seller_sales(integer);

create function public.seller_sales(p_limit integer default 50)
returns table (
  order_id uuid,
  sold_at timestamptz,
  order_status text,
  listing_id uuid,
  item_title text,
  item_price_aud numeric,
  commission_aud numeric,
  proceeds_aud numeric,
  payout_status text,
  stripe_transfer_id text,
  shipped_at timestamptz,
  tracking_carrier text,
  tracking_number text,
  delivered_at timestamptz,
  buyer_name text,
  is_cart_order boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    select
      o.id                                                          as order_id,
      o.created_at                                                  as sold_at,
      o.status::text                                                as order_status,
      o.listing_id                                                  as listing_id,
      null::text                                                    as item_title,
      coalesce(o.item_price_aud, 0)                                 as item_price_aud,
      greatest(coalesce(o.platform_fee_aud, 0) - coalesce(o.gst_aud, 0), 0) as commission_aud,
      coalesce(o.seller_proceeds_aud, 0)                            as proceeds_aud,
      o.payout_status::text                                         as payout_status,
      o.stripe_transfer_id                                          as stripe_transfer_id,
      o.shipped_at,
      o.tracking_carrier,
      o.tracking_number,
      o.delivered_at,
      coalesce(p.display_name, p.username, o.shipping_name)         as buyer_name,
      false                                                         as is_cart_order
    from orders o
    left join profiles p on p.id = o.buyer_id
    where o.seller_id = (select auth.uid())

    union all

    select
      o.id,
      o.created_at,
      o.status::text,
      nullif(l ->> 'id', '')::uuid,
      l ->> 'title',
      coalesce((l ->> 'line_total_aud')::numeric, 0),
      coalesce((l ->> 'commission_aud')::numeric, 0),
      coalesce(
        (l -> 'payout' ->> 'proceeds')::numeric,
        coalesce((l ->> 'line_total_aud')::numeric, 0) - coalesce((l ->> 'commission_aud')::numeric, 0)
      ),
      coalesce(l -> 'payout' ->> 'status', o.payout_status::text),
      l -> 'payout' ->> 'transferId',
      o.shipped_at,
      o.tracking_carrier,
      o.tracking_number,
      o.delivered_at,
      coalesce(p.display_name, p.username, o.shipping_name),
      true
    from orders o
    left join profiles p on p.id = o.buyer_id
    cross join lateral jsonb_array_elements(coalesce(o.order_items::jsonb, '[]'::jsonb)) l
    where o.seller_id is distinct from (select auth.uid())   -- never double-count
      and l ->> 'seller_id' = (select auth.uid())::text
      and coalesce(l ->> 'type', 'listing') = 'listing'
  ) s
  order by s.sold_at desc
  limit greatest(coalesce(p_limit, 50), 0);
$$;

create function public.seller_sales_summary()
returns table (completed_sales bigint, revenue_aud numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    coalesce(sum(s.proceeds_aud), 0)::numeric
  from public.seller_sales(1000000) s
  where s.order_status = 'completed';
$$;

-- The buyer's delivery address for one of the caller's own sales. Returns no
-- row for anyone else's order.
create or replace function public.seller_sale_shipping(p_order_id uuid)
returns table (
  order_id uuid,
  shipping_name text,
  shipping_address text,
  shipping_suburb text,
  shipping_state text,
  shipping_postcode text,
  buyer_name text,
  item_titles text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.shipping_name,
    o.shipping_address,
    o.shipping_suburb,
    o.shipping_state,
    o.shipping_postcode,
    coalesce(p.display_name, p.username, o.shipping_name),
    -- Only this seller's lines, so a cart seller doesn't learn what else was bought.
    coalesce(
      (select array_agg(l ->> 'title')
         from jsonb_array_elements(coalesce(o.order_items::jsonb, '[]'::jsonb)) l
        where l ->> 'seller_id' = (select auth.uid())::text),
      array[]::text[]
    )
  from orders o
  left join profiles p on p.id = o.buyer_id
  where o.id = p_order_id
    and (
      o.seller_id = (select auth.uid())
      or exists (
        select 1 from jsonb_array_elements(coalesce(o.order_items::jsonb, '[]'::jsonb)) l
        where l ->> 'seller_id' = (select auth.uid())::text
      )
    );
$$;

revoke execute on function public.seller_sales(integer) from public, anon;
revoke execute on function public.seller_sales_summary() from public, anon;
revoke execute on function public.seller_sale_shipping(uuid) from public, anon;
grant execute on function public.seller_sales(integer) to authenticated;
grant execute on function public.seller_sales_summary() to authenticated;
grant execute on function public.seller_sale_shipping(uuid) to authenticated;
