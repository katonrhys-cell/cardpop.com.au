-- Sequential, human-readable order numbers: CP-000123.
--
-- Until now an order was identified to people by the first 8 characters of its
-- UUID (`0F0F0F0F`) — random, unmemorable and impossible to say over the phone.
-- This gives every order a number from one sequence, in the order orders are
-- created, that buyers, sellers and admins all see (Account → Orders, Sales,
-- Order Management, emails, the tax invoice PDF).
--
--   * `orders.order_number` — text, unique, NOT NULL, `CP-` + 6 digits.
--   * The database owns it. A BEFORE INSERT trigger always assigns the next
--     number (a caller can't pick or spoof one, and the two Express insert
--     paths need no change), and it can't be changed once set.
--   * Existing orders are numbered in the order they were placed.
--   * Numbers are NOT gapless: an order row is written `pending` when its
--     Checkout Session is created, so an abandoned checkout uses a number.
--     That is fine for an order reference; the gapless series for the
--     accountant is the invoice number (INV-… / CN-…), which is unchanged.
--
-- Idempotent: re-running changes nothing. Backward-compatible: the app reads
-- `order_number` with a fall-back to the short id, so the schema can land first.

create sequence if not exists public.order_number_seq start with 1;

alter table public.orders add column if not exists order_number text;

-- ── Assigning the number ─────────────────────────────────────────────────────
-- security definer so the role doing the insert (service role today, any
-- future RLS-scoped insert) never needs USAGE on the sequence itself.
create or replace function public.orders_assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.order_number := 'CP-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  elsif old.order_number is not null then
    -- Once issued, a number never changes (it is printed on invoices and
    -- emailed). Only the one-off backfill below ever sets a null one.
    new.order_number := old.order_number;
  end if;
  return new;
end $$;

revoke all on function public.orders_assign_order_number() from public, anon, authenticated;

-- Created before the backfill so no order inserted while it runs can escape
-- without a number.
drop trigger if exists trg_orders_assign_order_number on public.orders;
create trigger trg_orders_assign_order_number
  before insert or update of order_number on public.orders
  for each row execute function public.orders_assign_order_number();

-- ── Backfill, oldest first ───────────────────────────────────────────────────
-- A loop, not one UPDATE ... nextval(): the numbers must follow created_at, and
-- the order a set-based UPDATE evaluates nextval() in isn't guaranteed. The only
-- triggers on `orders` that react to an update fire on `update of status`, so
-- this touches no invoices, notifications or points.
do $$
declare
  r record;
begin
  for r in
    select id from public.orders where order_number is null order by created_at, id
  loop
    update public.orders
       set order_number = 'CP-' || lpad(nextval('public.order_number_seq')::text, 6, '0')
     where id = r.id;
  end loop;
end $$;

-- ── Constraints ──────────────────────────────────────────────────────────────
alter table public.orders alter column order_number set not null;

create unique index if not exists orders_order_number_key
  on public.orders (order_number);

comment on column public.orders.order_number is
  'Sequential reference shown to buyers, sellers and admins (CP-000123). Assigned by trg_orders_assign_order_number; never write it.';

-- ── Sellers reading the number of their own sales ───────────────────────────
-- A seller can read an `orders` row only when they are its single `seller_id`.
-- A cart can hold several sellers' cards, and then the seller appears only
-- inside `order_items` — so My Sales (which reads seller_sales(), a security
-- definer function) could not look the number up from the table. This returns
-- order numbers for exactly the orders seller_sales() would show the caller:
-- same ownership rule, nothing else about the order.
create or replace function public.seller_order_numbers(p_order_ids uuid[])
returns table (order_id uuid, order_number text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.id, o.order_number
  from public.orders o
  where o.id = any (coalesce(p_order_ids, '{}'::uuid[]))
    and (
      o.seller_id = (select auth.uid())
      or exists (
        select 1
        from jsonb_array_elements(coalesce(o.order_items::jsonb, '[]'::jsonb)) l
        where l ->> 'seller_id' = (select auth.uid())::text
          and coalesce(l ->> 'type', 'listing') = 'listing'
      )
    );
$$;

revoke execute on function public.seller_order_numbers(uuid[]) from public, anon;
grant execute on function public.seller_order_numbers(uuid[]) to authenticated, service_role;
