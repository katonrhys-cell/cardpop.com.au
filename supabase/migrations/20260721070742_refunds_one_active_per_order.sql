-- Prevent more than one active refund per order (SECURITY_AUDIT_2026-07-21 → M7).
--
-- /refunds/request does a check-then-insert (read order.refund_status, then
-- INSERT a refunds row). Two concurrent requests both pass the check and create
-- TWO refund rows for one order. refundService.processRefund then guards each
-- ROW independently (CAS approved->processing + a top-of-handler
-- order.status='refunded' check), so if both rows are approved and processed in
-- the same window each reads order.status <> 'refunded' and each issues a
-- SEPARATE Stripe refund (distinct idempotency keys) — the buyer is refunded
-- twice. The companion code change keys Stripe idempotency on order_id so the
-- money can't double even if two rows exist; this index closes it at the source
-- by making a second *active* refund row impossible.
--
-- "Active" = any status except 'rejected' (the only terminal-fail state — a
-- Stripe error reverts to 'approved', not a terminal state). Rejected refunds
-- are excluded so a buyer can legitimately re-request after a rejection.
--
-- Guarded so it can never break a deploy: skipped if the (dashboard-created,
-- not-in-repo) refunds table is absent, e.g. a fresh local db reset; and if
-- legacy duplicate active refunds already exist the index is skipped with a
-- NOTICE rather than aborting the migration (resolve the dups, then add it).
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'refunds'
  ) then
    raise notice 'public.refunds does not exist; skipping refunds_one_active_per_order.';
    return;
  end if;

  begin
    create unique index if not exists refunds_one_active_per_order
      on public.refunds (order_id)
      where status is distinct from 'rejected';
  exception
    when unique_violation then
      raise notice 'refunds_one_active_per_order not created: duplicate active refunds exist for some order_id. Resolve the duplicates, then add the index.';
  end;
end $$;
