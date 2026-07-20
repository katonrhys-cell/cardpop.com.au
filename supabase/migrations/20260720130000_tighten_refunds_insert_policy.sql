-- Tighten the refunds INSERT policy to require the buyer own the referenced order.
--
-- The existing policy "buyers can insert refund requests" checks only
--   buyer_id = auth.uid() AND requested_by = auth.uid()
-- but never verifies the row's order_id belongs to that buyer. So any
-- authenticated user could insert a refunds row against ANY order (setting
-- buyer_id/requested_by to themselves) — spurious refund requests against
-- orders they never placed. No theft is possible (approved refunds pay the
-- original payer, and the admin flow recomputes from the order), but it lets a
-- user spam the admin refund queue and pollute another order's refund history.
--
-- The buyer-facing flow now goes through the server (POST /refunds/request,
-- service-role) which already validates order ownership; this closes the direct
-- client-insert path too, for defence in depth. Add an EXISTS check that the
-- order exists and its buyer_id is the caller.
--
-- Idempotent: drop-if-exists then recreate.
drop policy if exists "buyers can insert refund requests" on public.refunds;
create policy "buyers can insert refund requests" on public.refunds
  as permissive for insert to public
  with check (
    (buyer_id = (select auth.uid()))
    and (requested_by = (select auth.uid()))
    and (exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.buyer_id = (select auth.uid())
    ))
  );
