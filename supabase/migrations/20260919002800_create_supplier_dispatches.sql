-- Supplier dispatches: one row per (order, supplier) fulfilment hand-off.
--
-- Why this table exists rather than just calling Resend from the webhook.
--
-- 1. IDEMPOTENCY. Stripe retries webhook deliveries, and two deliveries of
--    `checkout.session.completed` can be in flight at once. A bare "send the
--    email" in that path can dispatch the same parcel twice — the supplier picks
--    and posts it twice, and CardPop pays for both. The unique constraint on
--    (order_id, supplier_id) makes the INSERT itself the claim: exactly one
--    delivery wins and sends, every other one loses and returns.
--
-- 2. VISIBILITY. On 2026-07-16 a live payment sat unfulfilled for two weeks
--    because `checkout.session.completed` never arrived while five sibling
--    events processed fine (see pendingOrderAlertService.js). A fire-and-forget
--    email inherits that failure mode with a customer's money attached: the
--    buyer has paid, the supplier never heard, and nothing anywhere is red. A
--    row that is still 'pending' or 'failed' is a queryable, alertable,
--    re-sendable fact.
--
-- 3. AUDIT. A dispatch email sends a named customer's residential address to a
--    third-party business. `payload` records exactly what was disclosed, to
--    which address, and when.

create table if not exists public.supplier_dispatches (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null references public.orders(id) on delete cascade,
  -- restrict, not cascade: the dispatch record is the evidence of what was sent
  -- to whom. Deleting a supplier must not erase its fulfilment history.
  supplier_id uuid not null references public.suppliers(id) on delete restrict,

  --   pending — claimed, email not yet confirmed sent
  --   sent    — Resend accepted it
  --   failed  — send attempted and rejected; safe to retry
  --   skipped — supplier inactive or has no address; nothing was sent
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),

  -- The exact content emailed: lines (title, sku, quantity), the shipping
  -- address as disclosed, and the blind-shipping note in force at the time.
  payload jsonb not null default '{}'::jsonb,

  -- Resolved at send time and recorded, because suppliers.fulfilment_email can
  -- change later and this must stay the address actually used.
  recipient_email text,

  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The idempotency guard. One hand-off per supplier per order, forever.
  constraint supplier_dispatches_order_supplier_key unique (order_id, supplier_id)
);

create index if not exists idx_supplier_dispatches_order on public.supplier_dispatches (order_id);
-- Drives the "what hasn't gone out?" query: unresolved dispatches, oldest first.
create index if not exists idx_supplier_dispatches_unresolved
  on public.supplier_dispatches (created_at)
  where status in ('pending', 'failed');

alter table public.supplier_dispatches enable row level security;

-- Admin-only. The backend writes these with the service-role key, which bypasses
-- RLS entirely, so this policy governs only the admin UI's reads.
drop policy if exists "supplier_dispatches_admin_all" on public.supplier_dispatches;
create policy "supplier_dispatches_admin_all"
  on public.supplier_dispatches for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
