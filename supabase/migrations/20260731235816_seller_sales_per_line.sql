-- Seller-facing views of sales could not see cart sales at all.
--
-- A cart can span multiple sellers, so a cart order carries seller_id = NULL on
-- the row and puts the seller inside each order_items line. The write path
-- handles that correctly (per-line payouts, per-line reversals), but every
-- seller-facing read still filtered on orders.seller_id:
--
--   AccountWallet    — "Sale Payouts" history
--   AccountDashboard — completed-sales count and total revenue
--
-- so a cart sale appeared nowhere in the seller's account, whether or not it
-- was fulfilled and paid. The orders RLS policy has the same shape
-- (auth.uid() = seller_id), so the rows aren't even readable.
--
-- These functions resolve the seller per line and return only the caller's own
-- lines. SECURITY DEFINER because the underlying rows are deliberately not
-- readable by a per-line seller — exposing the whole orders row would hand a
-- seller the buyer's address plus every other seller's lines in the same cart.
-- The column list here is the seller's own line and nothing else.

-- One row per sale line belonging to the calling seller, newest first.
create or replace function public.seller_sales(p_limit integer default 50)
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
  stripe_transfer_id text
)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    -- Single-item orders: the seller is on the row, and the order-level payout
    -- columns hold the answer. platform_fee_aud bundles commission + GST, so
    -- the seller's commission is that minus GST.
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
      o.stripe_transfer_id                                          as stripe_transfer_id
    from orders o
    where o.seller_id = (select auth.uid())

    union all

    -- Cart orders: one row per line this seller owns. Before fulfilment there
    -- is no line.payout yet, so proceeds fall back to the same arithmetic the
    -- webhook uses (line total minus commission) — the seller sees what they
    -- are owed, not a blank.
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
      l -> 'payout' ->> 'transferId'
    from orders o
    cross join lateral jsonb_array_elements(coalesce(o.order_items::jsonb, '[]'::jsonb)) l
    where o.seller_id is distinct from (select auth.uid())   -- never double-count
      and l ->> 'seller_id' = (select auth.uid())::text
      and coalesce(l ->> 'type', 'listing') = 'listing'
  ) s
  order by s.sold_at desc
  limit greatest(coalesce(p_limit, 50), 0);
$$;

-- Dashboard headline figures. Revenue is the seller's own proceeds — the
-- previous query summed orders.total_aud, which is what the *buyer* paid
-- (commission and GST included), overstating seller revenue on every sale.
create or replace function public.seller_sales_summary()
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

-- Callable by signed-in users only; the functions self-filter on auth.uid(),
-- which is null for anon.
revoke execute on function public.seller_sales(integer) from public, anon;
revoke execute on function public.seller_sales_summary() from public, anon;
grant execute on function public.seller_sales(integer) to authenticated;
grant execute on function public.seller_sales_summary() to authenticated;
