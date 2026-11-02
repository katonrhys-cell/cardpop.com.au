-- Order invoices: one tax invoice per paid order, issued by the database.
--
-- Until now the only "invoice" an order had was the itemised receipt emailed by
-- the Stripe webhook — nothing in the schema carried an invoice number, a
-- line-by-line GST split or a place to record the matching document in an
-- accounting system. This migration adds that layer so every paid order can be
-- pushed to Xero (or exported to its CSV import) and reconciled back:
--
--   * invoices — one row per document. kind 'tax_invoice' (one per paid order,
--     unique on order_id) or 'credit_note' (issued when the order is refunded,
--     pointing at the invoice it credits). Sequential numbers INV-000001 /
--     CN-000001 from two sequences. Every amount the buyer saw is snapshotted
--     onto the row at issue time (header totals + a `lines` jsonb array with
--     the GST inside each line) so a later price, fee or product change can't
--     alter a document that was already issued.
--   * issue_invoice_for_order(order_id) — builds the invoice from the order row
--     (cart lines from order_items, a Buy Now order from its listing), the
--     order's fee / shipping / processing / discount columns and its recorded
--     GST figures. Idempotent: an order that already has an invoice gets the
--     same id back (a voided one is reinstated).
--   * issue_credit_note_for_order(order_id, amount) — a credit note for a
--     refunded order, lines scaled pro-rata when the refund is partial.
--   * trg_orders_issue_invoice — AFTER INSERT OR UPDATE OF status on orders:
--     the transition into a paid status issues the invoice, a fall back to
--     pending / payment_failed / cancelled voids it, and 'refunded' issues the
--     credit note. Both webhook paths (cart: pending → payment_confirmed
--     UPDATE; single item: INSERT already payment_confirmed) are covered.
--     The trigger body is wrapped in an exception handler: an invoice problem
--     must never fail the order update that records a buyer's payment.
--   * issue_missing_invoices() — the backfill (run once below) and the
--     "Issue missing" button in Admin → Invoices.
--
-- Accounting link: accounting_provider / accounting_invoice_id /
-- accounting_number / accounting_url / accounting_sync_status / _synced_at /
-- _sync_error are filled by the Xero sync (manual "mark as synced" today, API
-- push later). Which Xero account code and tax type each line kind posts to is
-- data, not code: the two platform_settings rows seeded at the bottom
-- (invoice_xero_account_codes / invoice_xero_tax_types) are read by
-- src/utils/invoiceAccounting.js — see docs/order-invoices.md.
--
-- Amounts: every price is GST-inclusive (docs/order-pricing.md). Line GST is
-- the component *inside* the line, 1/11 at 10%. Legacy orders from before the
-- inclusive change (gst_aud > 0 = GST added on top of the commission) keep
-- that treatment: their item lines carry no GST and the commission line carries
-- gst_aud. The header gst_aud is the order's own recorded figure
-- (gst_included_aud + gst_aud), which the lines may differ from by a cent.
--
-- RLS: a buyer may read their own invoices (so Account → Orders can offer the
-- document later), admins read everything, and nothing is writable from a
-- client — invoices are issued by the trigger / functions and updated only by
-- the service-role backend.

-- ── Numbering ────────────────────────────────────────────────────────────────
create sequence if not exists public.invoice_number_seq start with 1;
create sequence if not exists public.credit_note_number_seq start with 1;

-- ── invoices ─────────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders(id) on delete cascade,
  kind                    text not null default 'tax_invoice'
                          check (kind in ('tax_invoice', 'credit_note')),
  number                  text not null unique,
  sequence                bigint not null,
  status                  text not null default 'paid'
                          check (status in ('issued', 'paid', 'credited', 'void')),
  -- The document date (the day the buyer paid, Australian time) vs. the moment
  -- the row was written (a backfilled invoice carries the original sale date).
  invoice_date            date not null,
  issued_at               timestamptz not null default now(),
  due_date                date not null,
  paid_at                 timestamptz,
  voided_at               timestamptz,
  -- Credit notes point at the invoice they credit; an invoice records how much
  -- of it has been credited.
  credits_invoice_id      uuid references public.invoices(id) on delete set null,
  credited_aud            numeric(10,2) not null default 0,
  -- Buyer / bill-to snapshot.
  buyer_id                uuid references public.profiles(id) on delete set null,
  buyer_name              text,
  buyer_email             text,
  billing_business_name   text,
  billing_abn             text,
  ship_to                 jsonb,
  -- Money. All GST-inclusive AUD; the GST figures are the component inside.
  currency                text not null default 'AUD',
  subtotal_aud            numeric(10,2) not null default 0,  -- items only
  shipping_aud            numeric(10,2) not null default 0,  -- shop + seller postage
  commission_aud          numeric(10,2) not null default 0,  -- service fee incl. its GST
  processing_fee_aud      numeric(10,2) not null default 0,
  discount_aud            numeric(10,2) not null default 0,  -- positive number, shown as a negative line
  adjustment_aud          numeric(10,2) not null default 0,  -- total − sum(lines): rounding
  total_aud               numeric(10,2) not null default 0,
  gst_aud                 numeric(10,2) not null default 0,  -- GST inside total_aud
  seller_gst_aud          numeric(10,2) not null default 0,  -- the part remitted on sellers' behalf
  platform_gst_aud        numeric(10,2) not null default 0,  -- the part inside CardPop's own fees
  -- [{ kind, description, quantity, unit_amount_aud, amount_aud, gst_aud,
  --    source_type, source_id, seller_id, sku }] — kind is one of shop_item,
  --    marketplace_item, shop_shipping, seller_shipping, commission,
  --    processing_fee, discount, adjustment.
  lines                   jsonb not null default '[]'::jsonb,
  -- Payment reference.
  stripe_session_id       text,
  stripe_payment_intent_id text,
  payment_method          text,
  -- Accounting system link (Xero).
  accounting_provider     text,
  accounting_invoice_id   text,
  accounting_number       text,
  accounting_url          text,
  accounting_sync_status  text not null default 'pending'
                          check (accounting_sync_status in ('pending', 'synced', 'failed', 'skipped')),
  accounting_synced_at    timestamptz,
  accounting_sync_error   text,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- One tax invoice and at most one credit note per order.
create unique index if not exists invoices_order_kind_uidx on public.invoices (order_id, kind);
create unique index if not exists invoices_kind_sequence_uidx on public.invoices (kind, sequence);
create index if not exists invoices_invoice_date_idx on public.invoices (invoice_date desc, sequence desc);
create index if not exists invoices_buyer_id_idx on public.invoices (buyer_id) where buyer_id is not null;
create index if not exists invoices_sync_status_idx on public.invoices (accounting_sync_status) where accounting_sync_status <> 'synced';

comment on table public.invoices is
  'One tax invoice per paid order (plus a credit note per refunded order), issued by the trg_orders_issue_invoice trigger. Amounts are snapshotted at issue; lines carry the GST inside each line. Accounting_* columns record the matching Xero document — see docs/order-invoices.md.';
comment on column public.invoices.lines is
  'Snapshot of the document lines: [{kind, description, quantity, unit_amount_aud, amount_aud, gst_aud, source_type, source_id, seller_id, sku}]. kind ∈ shop_item | marketplace_item | shop_shipping | seller_shipping | commission | processing_fee | discount | adjustment.';
comment on column public.invoices.adjustment_aud is
  'total_aud minus the sum of the itemised lines — a rounding difference. Emitted as an "adjustment" line so an export always balances to what was charged.';

create or replace function public.invoices_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute function public.invoices_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.invoices enable row level security;

drop policy if exists invoices_select_own on public.invoices;
create policy invoices_select_own on public.invoices
  for select to authenticated
  using (buyer_id = (select auth.uid()));

drop policy if exists invoices_select_admin on public.invoices;
create policy invoices_select_admin on public.invoices
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

grant select on public.invoices to authenticated;
revoke insert, update, delete on public.invoices from anon, authenticated;

-- ── Helpers ──────────────────────────────────────────────────────────────────
-- GST component inside a GST-inclusive amount (1/11 at 10%).
create or replace function public.invoice_gst_inside(p_amount numeric, p_rate numeric)
returns numeric language sql immutable as $$
  select case
    when p_amount is null or p_rate is null or p_rate <= 0 then 0
    else round(p_amount * p_rate / (100 + p_rate), 2)
  end
$$;

-- Order statuses that mean the buyer's money was taken (and so an invoice is
-- owed). Mirrors PAID_ORDER_STATUSES in utils/revenue.js.
create or replace function public.invoice_paid_statuses()
returns text[] language sql immutable as $$
  select array['payment_confirmed', 'shipped', 'delivered', 'completed', 'disputed', 'refunded']
$$;

-- ── issue_invoice_for_order ──────────────────────────────────────────────────
create or replace function public.issue_invoice_for_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o              public.orders%rowtype;
  v_existing     public.invoices%rowtype;
  v_rate         numeric;
  v_inclusive    boolean;
  v_lines        jsonb := '[]'::jsonb;
  v_item         jsonb;
  v_type         text;
  v_qty          numeric;
  v_total        numeric;
  v_unit         numeric;
  v_gst          numeric;
  v_ship         numeric;
  v_subtotal     numeric := 0;
  v_seller_ship  numeric := 0;
  v_shop_ship    numeric := 0;
  v_commission   numeric := 0;
  v_commission_gst numeric := 0;
  v_sum          numeric := 0;
  v_adjust       numeric := 0;
  v_card_name    text;
  v_seller_name  text;
  v_buyer_name   text;
  v_buyer_email  text;
  v_seq          bigint;
  v_id           uuid;
  v_date         date;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then
    return null;
  end if;
  if not (o.status::text = any (public.invoice_paid_statuses())) then
    return null;
  end if;

  select * into v_existing from public.invoices where order_id = p_order_id and kind = 'tax_invoice';
  if found then
    -- A voided invoice (order fell back to pending and was then paid after
    -- all) is reinstated rather than re-numbered.
    if v_existing.status = 'void' then
      update public.invoices
         set status = case when v_existing.credited_aud > 0 then 'credited' else 'paid' end,
             voided_at = null
       where id = v_existing.id;
    end if;
    return v_existing.id;
  end if;

  -- GST rate in force, and whether this order was priced GST-inclusive (every
  -- order from 2026-09 on; before that GST was added on top of the commission
  -- as gst_aud and the item lines carried none).
  select coalesce(nullif(trim(both '"' from value::text), '')::numeric, 10)
    into v_rate
    from public.platform_settings where key = 'gst_rate_pct';
  v_rate := coalesce(v_rate, 10);
  v_inclusive := coalesce(o.gst_included_aud, 0) > 0 or coalesce(o.gst_aud, 0) = 0;
  if coalesce(o.gst_included_aud, 0) = 0 and coalesce(o.gst_aud, 0) = 0 then
    -- No GST recorded on the order at all (gst_enabled off): no line carries any.
    v_rate := 0;
  end if;

  -- ── Item lines ─────────────────────────────────────────────────────────────
  if jsonb_typeof(o.order_items) = 'array' and jsonb_array_length(o.order_items) > 0 then
    for v_item in select value from jsonb_array_elements(o.order_items) loop
      v_type  := coalesce(v_item->>'type', 'listing');
      v_qty   := coalesce(nullif(v_item->>'quantity', '')::numeric, 1);
      v_total := coalesce(nullif(v_item->>'line_total_aud', '')::numeric,
                          nullif(v_item->>'price_aud', '')::numeric,
                          nullif(v_item->>'price', '')::numeric, 0);
      v_unit  := coalesce(nullif(v_item->>'unit_price_aud', '')::numeric,
                          case when v_qty > 0 then round(v_total / v_qty, 2) else v_total end);
      v_gst   := case when v_inclusive
                      then coalesce(nullif(v_item->>'gst_aud', '')::numeric, public.invoice_gst_inside(v_total, v_rate))
                      else 0 end;
      v_lines := v_lines || jsonb_build_object(
        'kind',            case when v_type = 'shop' then 'shop_item' else 'marketplace_item' end,
        'description',     coalesce(v_item->>'title', v_item->>'name', v_item->>'card_name', 'Item'),
        'quantity',        v_qty,
        'unit_amount_aud', v_unit,
        'amount_aud',      v_total,
        'gst_aud',         v_gst,
        'source_type',     v_type,
        'source_id',       v_item->>'id',
        'seller_id',       v_item->>'seller_id',
        'sku',             coalesce(v_item->>'variant_sku', v_item->>'sku')
      );
      v_subtotal := v_subtotal + v_total;

      -- Seller postage rides on the parcel-defining line of each seller.
      v_ship := coalesce(nullif(v_item->>'shipping_aud', '')::numeric, 0);
      if v_ship > 0 then
        v_lines := v_lines || jsonb_build_object(
          'kind',            'seller_shipping',
          'description',     'Postage',
          'quantity',        1,
          'unit_amount_aud', v_ship,
          'amount_aud',      v_ship,
          'gst_aud',         case when v_inclusive then public.invoice_gst_inside(v_ship, v_rate) else 0 end,
          'source_type',     'listing',
          'source_id',       v_item->>'id',
          'seller_id',       v_item->>'seller_id'
        );
        v_seller_ship := v_seller_ship + v_ship;
      end if;
    end loop;
    v_shop_ship := coalesce(o.shipping_aud, 0) - v_seller_ship;
  else
    -- Single-item (Buy Now / accepted offer) order: one card, one seller.
    select vi.card_name into v_card_name
      from public.listings l
      left join public.vault_items vi on vi.id = l.vault_item_id
     where l.id = o.listing_id;
    v_total := coalesce(o.item_price_aud, 0);
    v_lines := v_lines || jsonb_build_object(
      'kind',            'marketplace_item',
      'description',     coalesce(v_card_name, 'Trading card'),
      'quantity',        1,
      'unit_amount_aud', v_total,
      'amount_aud',      v_total,
      'gst_aud',         case when v_inclusive then public.invoice_gst_inside(v_total, v_rate) else 0 end,
      'source_type',     'listing',
      'source_id',       o.listing_id,
      'seller_id',       o.seller_id
    );
    v_subtotal := v_total;
    v_ship := coalesce(o.shipping_aud, 0);
    if v_ship > 0 then
      v_lines := v_lines || jsonb_build_object(
        'kind',            'seller_shipping',
        'description',     'Postage',
        'quantity',        1,
        'unit_amount_aud', v_ship,
        'amount_aud',      v_ship,
        'gst_aud',         case when v_inclusive then public.invoice_gst_inside(v_ship, v_rate) else 0 end,
        'source_type',     'listing',
        'source_id',       o.listing_id,
        'seller_id',       o.seller_id
      );
      v_seller_ship := v_ship;
    end if;
  end if;

  -- ── CardPop's own lines ────────────────────────────────────────────────────
  if v_shop_ship > 0 then
    v_lines := v_lines || jsonb_build_object(
      'kind', 'shop_shipping', 'description', 'Shipping', 'quantity', 1,
      'unit_amount_aud', v_shop_ship, 'amount_aud', v_shop_ship,
      'gst_aud', case when v_inclusive then public.invoice_gst_inside(v_shop_ship, v_rate) else 0 end,
      'source_type', 'shop');
  end if;

  -- platform_fee_aud = commission + any GST that was ADDED on top (legacy).
  v_commission := coalesce(o.platform_fee_aud, 0);
  if v_commission > 0 then
    v_commission_gst := coalesce(o.gst_aud, 0)
      + case when v_inclusive then public.invoice_gst_inside(v_commission - coalesce(o.gst_aud, 0), v_rate) else 0 end;
    v_lines := v_lines || jsonb_build_object(
      'kind', 'commission', 'description', 'Service fee', 'quantity', 1,
      'unit_amount_aud', v_commission, 'amount_aud', v_commission,
      'gst_aud', v_commission_gst, 'source_type', 'platform');
  end if;

  if coalesce(o.processing_fee_aud, 0) > 0 then
    v_lines := v_lines || jsonb_build_object(
      'kind', 'processing_fee', 'description', 'Payment processing', 'quantity', 1,
      'unit_amount_aud', o.processing_fee_aud, 'amount_aud', o.processing_fee_aud,
      'gst_aud', case when v_inclusive then public.invoice_gst_inside(o.processing_fee_aud, v_rate) else 0 end,
      'source_type', 'platform');
  end if;

  if coalesce(o.discount_aud, 0) > 0 then
    v_lines := v_lines || jsonb_build_object(
      'kind', 'discount', 'description', 'Discount', 'quantity', 1,
      'unit_amount_aud', -o.discount_aud, 'amount_aud', -o.discount_aud,
      'gst_aud', case when v_inclusive then -public.invoice_gst_inside(o.discount_aud, v_rate) else 0 end,
      'source_type', 'platform');
  end if;

  -- Whatever the itemised lines don't explain (cent rounding) so the document
  -- always sums to the amount actually charged.
  select coalesce(sum((l->>'amount_aud')::numeric), 0) into v_sum from jsonb_array_elements(v_lines) l;
  v_adjust := round(coalesce(o.total_aud, 0) - v_sum, 2);
  if v_adjust <> 0 then
    v_lines := v_lines || jsonb_build_object(
      'kind', 'adjustment', 'description', 'Rounding adjustment', 'quantity', 1,
      'unit_amount_aud', v_adjust, 'amount_aud', v_adjust, 'gst_aud', 0, 'source_type', 'platform');
  end if;

  -- ── Buyer snapshot ─────────────────────────────────────────────────────────
  if o.buyer_id is not null then
    select p.display_name, p.email into v_buyer_name, v_buyer_email
      from public.profiles p where p.id = o.buyer_id;
  end if;
  v_buyer_name  := coalesce(nullif(o.billing_business_name, ''), nullif(o.shipping_name, ''), v_buyer_name, 'Customer');
  v_buyer_email := coalesce(nullif(o.buyer_email, ''), v_buyer_email);

  v_date := (coalesce(o.created_at, now()) at time zone 'Australia/Sydney')::date;
  v_seq  := nextval('public.invoice_number_seq');

  insert into public.invoices (
    order_id, kind, number, sequence, status, invoice_date, due_date, paid_at,
    buyer_id, buyer_name, buyer_email, billing_business_name, billing_abn, ship_to,
    subtotal_aud, shipping_aud, commission_aud, processing_fee_aud, discount_aud, adjustment_aud,
    total_aud, gst_aud, seller_gst_aud, platform_gst_aud, lines,
    stripe_session_id, stripe_payment_intent_id, payment_method
  ) values (
    o.id, 'tax_invoice', 'INV-' || lpad(v_seq::text, 6, '0'), v_seq,
    case when o.status::text = 'refunded' then 'credited' else 'paid' end,
    v_date, v_date, coalesce(o.created_at, now()),
    o.buyer_id, v_buyer_name, v_buyer_email, nullif(o.billing_business_name, ''), nullif(o.billing_abn, ''),
    jsonb_strip_nulls(jsonb_build_object(
      'name', o.shipping_name, 'address', o.shipping_address, 'suburb', o.shipping_suburb,
      'state', o.shipping_state, 'postcode', o.shipping_postcode, 'country', 'AU')),
    round(v_subtotal, 2), round(coalesce(o.shipping_aud, 0), 2), round(v_commission, 2),
    round(coalesce(o.processing_fee_aud, 0), 2), round(coalesce(o.discount_aud, 0), 2), v_adjust,
    round(coalesce(o.total_aud, 0), 2),
    round(coalesce(o.gst_included_aud, 0) + coalesce(o.gst_aud, 0), 2),
    round(coalesce(o.seller_gst_aud, 0), 2), round(coalesce(o.platform_gst_aud, 0), 2), v_lines,
    o.stripe_session_id, o.stripe_payment_intent_id,
    coalesce(o.payment_wallet_type, 'card')
  )
  on conflict (order_id, kind) do update set updated_at = now()
  returning id into v_id;

  return v_id;
end $$;

-- ── issue_credit_note_for_order ──────────────────────────────────────────────
-- Issues the credit note for a refunded order. p_amount defaults to the latest
-- processed refund on the order (refunds.refund_amount_aud) and, failing that,
-- the invoice total — the Buyer Protection policy refunds in full. Lines are
-- the invoice's lines scaled pro-rata (cent remainder on the largest line).
create or replace function public.issue_credit_note_for_order(p_order_id uuid, p_amount numeric default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv       public.invoices%rowtype;
  v_existing  uuid;
  v_amount    numeric;
  v_ratio     numeric;
  v_lines     jsonb := '[]'::jsonb;
  v_line      jsonb;
  v_amt       numeric;
  v_sum       numeric := 0;
  v_largest   int := -1;
  v_largest_amt numeric := -1;
  v_i         int := 0;
  v_seq       bigint;
  v_id        uuid;
  v_date      date;
  v_order_created timestamptz;
begin
  perform public.issue_invoice_for_order(p_order_id);
  select * into v_inv from public.invoices where order_id = p_order_id and kind = 'tax_invoice';
  if not found then
    return null;
  end if;

  select id into v_existing from public.invoices where order_id = p_order_id and kind = 'credit_note';
  if found then
    return v_existing;
  end if;

  v_amount := p_amount;
  if v_amount is null and to_regclass('public.refunds') is not null then
    execute 'select refund_amount_aud from public.refunds where order_id = $1 and status = ''processed'' order by processed_at desc nulls last, created_at desc limit 1'
      into v_amount using p_order_id;
  end if;
  v_amount := round(coalesce(v_amount, v_inv.total_aud), 2);
  if v_amount <= 0 then
    return null;
  end if;
  if v_amount > v_inv.total_aud then
    v_amount := v_inv.total_aud;
  end if;

  v_ratio := case when v_inv.total_aud > 0 then v_amount / v_inv.total_aud else 1 end;
  for v_line in select value from jsonb_array_elements(v_inv.lines) loop
    v_amt := round((v_line->>'amount_aud')::numeric * v_ratio, 2);
    v_lines := v_lines || (v_line || jsonb_build_object(
      'amount_aud', v_amt,
      'unit_amount_aud', v_amt,
      'quantity', 1,
      'gst_aud', round(coalesce((v_line->>'gst_aud')::numeric, 0) * v_ratio, 2)));
    v_sum := v_sum + v_amt;
    if abs(v_amt) > v_largest_amt then
      v_largest_amt := abs(v_amt);
      v_largest := v_i;
    end if;
    v_i := v_i + 1;
  end loop;
  -- Put the pro-rata rounding remainder on the largest line.
  if v_largest >= 0 and round(v_amount - v_sum, 2) <> 0 then
    v_lines := jsonb_set(v_lines, array[v_largest::text, 'amount_aud'],
      to_jsonb(round(((v_lines->v_largest->>'amount_aud')::numeric) + (v_amount - v_sum), 2)));
    v_lines := jsonb_set(v_lines, array[v_largest::text, 'unit_amount_aud'], v_lines->v_largest->'amount_aud');
  end if;

  select created_at into v_order_created from public.orders where id = p_order_id;
  v_date := (now() at time zone 'Australia/Sydney')::date;
  v_seq  := nextval('public.credit_note_number_seq');

  insert into public.invoices (
    order_id, kind, number, sequence, status, invoice_date, due_date, paid_at, credits_invoice_id,
    buyer_id, buyer_name, buyer_email, billing_business_name, billing_abn, ship_to,
    subtotal_aud, shipping_aud, commission_aud, processing_fee_aud, discount_aud, adjustment_aud,
    total_aud, gst_aud, seller_gst_aud, platform_gst_aud, lines,
    stripe_session_id, stripe_payment_intent_id, payment_method, notes
  ) values (
    p_order_id, 'credit_note', 'CN-' || lpad(v_seq::text, 6, '0'), v_seq, 'issued', v_date, v_date, now(), v_inv.id,
    v_inv.buyer_id, v_inv.buyer_name, v_inv.buyer_email, v_inv.billing_business_name, v_inv.billing_abn, v_inv.ship_to,
    round(v_inv.subtotal_aud * v_ratio, 2), round(v_inv.shipping_aud * v_ratio, 2), round(v_inv.commission_aud * v_ratio, 2),
    round(v_inv.processing_fee_aud * v_ratio, 2), round(v_inv.discount_aud * v_ratio, 2), 0,
    v_amount, round(v_inv.gst_aud * v_ratio, 2), round(v_inv.seller_gst_aud * v_ratio, 2), round(v_inv.platform_gst_aud * v_ratio, 2), v_lines,
    v_inv.stripe_session_id, v_inv.stripe_payment_intent_id, v_inv.payment_method,
    'Refund of ' || v_inv.number
  )
  on conflict (order_id, kind) do update set updated_at = now()
  returning id into v_id;

  update public.invoices
     set status = 'credited', credited_aud = v_amount
   where id = v_inv.id;

  return v_id;
end $$;

-- ── issue_missing_invoices ───────────────────────────────────────────────────
-- Every paid order without a tax invoice gets one (oldest first, so numbering
-- follows sale order), and every refunded order without a credit note gets
-- one. Returns the number of documents issued.
create or replace function public.issue_missing_invoices()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r       record;
  v_count integer := 0;
begin
  for r in
    select o.id from public.orders o
     where o.status::text = any (public.invoice_paid_statuses())
       and not exists (select 1 from public.invoices i where i.order_id = o.id and i.kind = 'tax_invoice')
     order by o.created_at, o.id
  loop
    if public.issue_invoice_for_order(r.id) is not null then v_count := v_count + 1; end if;
  end loop;

  for r in
    select o.id from public.orders o
     where o.status::text = 'refunded'
       and not exists (select 1 from public.invoices i where i.order_id = o.id and i.kind = 'credit_note')
     order by o.updated_at, o.id
  loop
    if public.issue_credit_note_for_order(r.id) is not null then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end $$;

revoke all on function public.issue_invoice_for_order(uuid) from public, anon, authenticated;
revoke all on function public.issue_credit_note_for_order(uuid, numeric) from public, anon, authenticated;
revoke all on function public.issue_missing_invoices() from public, anon, authenticated;
grant execute on function public.issue_invoice_for_order(uuid) to service_role;
grant execute on function public.issue_credit_note_for_order(uuid, numeric) to service_role;
grant execute on function public.issue_missing_invoices() to service_role;

-- ── Trigger on orders ────────────────────────────────────────────────────────
create or replace function public.orders_issue_invoice()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_paid constant text[] := public.invoice_paid_statuses();
begin
  begin
    if new.status::text = any (v_paid)
       and (tg_op = 'INSERT' or not (old.status::text = any (v_paid))) then
      perform public.issue_invoice_for_order(new.id);
    elsif tg_op = 'UPDATE'
       and old.status::text = any (v_paid)
       and new.status::text in ('pending', 'payment_failed', 'cancelled') then
      -- The cart webhook hands an order back to pending when nothing in it
      -- could be fulfilled; the document it issued a moment ago is void.
      update public.invoices
         set status = 'void', voided_at = now()
       where order_id = new.id and kind = 'tax_invoice' and status <> 'void';
    end if;

    if new.status::text = 'refunded'
       and (tg_op = 'INSERT' or old.status::text is distinct from 'refunded') then
      perform public.issue_credit_note_for_order(new.id);
    end if;
  exception when others then
    -- Never let an invoicing problem fail the write that records a payment.
    raise warning 'invoice issue failed for order %: % (%)', new.id, sqlerrm, sqlstate;
  end;
  return new;
end $$;

drop trigger if exists trg_orders_issue_invoice on public.orders;
create trigger trg_orders_issue_invoice
  after insert or update of status on public.orders
  for each row execute function public.orders_issue_invoice();

-- ── Xero mapping (data, editable without a deploy) ───────────────────────────
-- Which Xero account code and tax type each line kind posts to. The defaults
-- are Xero's standard AU chart (200 Sales, 260 Other Revenue) plus a liability
-- clearing account for money that belongs to a marketplace seller — create it
-- in Xero (or change the code here) before the first import.
insert into public.platform_settings (key, value, label, description, group_name)
values
  ('invoice_xero_account_codes',
   '{"shop_item":"200","shop_shipping":"200","marketplace_item":"835","seller_shipping":"835","commission":"260","processing_fee":"260","discount":"200","adjustment":"860"}'::jsonb,
   'Xero account codes by invoice line kind',
   'JSON object: line kind → Xero account code. Marketplace card and seller postage lines are the seller''s supply, held for payout — post them to a clearing / liability account, not to Sales.',
   'accounting'),
  ('invoice_xero_tax_types',
   '{"shop_item":"OUTPUT","shop_shipping":"OUTPUT","marketplace_item":"BASEXCLUDED","seller_shipping":"BASEXCLUDED","commission":"OUTPUT","processing_fee":"OUTPUT","discount":"OUTPUT","adjustment":"BASEXCLUDED"}'::jsonb,
   'Xero tax types by invoice line kind',
   'JSON object: line kind → Xero tax type (AU: OUTPUT = GST on Income, BASEXCLUDED, EXEMPTOUTPUT = GST Free Income). Confirm the marketplace treatment with your accountant.',
   'accounting')
on conflict (key) do nothing;

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Issue an invoice for every order that has already been paid, in sale order,
-- and a credit note for every refunded one.
select public.issue_missing_invoices();
