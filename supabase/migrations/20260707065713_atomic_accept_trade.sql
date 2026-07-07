-- Atomic trade acceptance.
--
-- hooks/useTradeRequests.js's acceptTrade() previously did this as two
-- separate client-side UPDATE calls: (1) accept this trade, (2) cancel any
-- other still-proposed trade touching either listing. A rollback handled the
-- case where step 2's own query errored, but not the race where a second
-- responder accepts a competing trade on the same listing in the window
-- between steps 1 and 2 of two concurrent acceptances — both could reach
-- 'accepted' before either's cancellation sweep runs, committing a listing
-- to two accepted trades. Doing both updates inside one function call makes
-- them a single transaction: the first UPDATE takes a row lock via its WHERE
-- clause, so a concurrent acceptance of a competing trade either commits
-- fully before or fully after this one, never interleaved.

create or replace function public.accept_trade(p_trade_id uuid, p_responder_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initiator_listing_id uuid;
  v_responder_listing_id uuid;
begin
  -- Atomically claim the trade: only succeeds if it's still proposed and
  -- owned by this responder — mirrors the .eq('responder_id', ...) the RLS
  -- client-side call relied on.
  update trades
  set status = 'accepted'
  where id = p_trade_id
    and responder_id = p_responder_id
    and status = 'proposed'
  returning initiator_listing_id, responder_listing_id
  into v_initiator_listing_id, v_responder_listing_id;

  if not found then
    return false;
  end if;

  -- Cancel any other still-proposed trade touching either listing, in the
  -- same transaction so a card can never end up committed to two accepted
  -- trades.
  update trades
  set status = 'cancelled'
  where status = 'proposed'
    and id <> p_trade_id
    and (
      initiator_listing_id in (v_initiator_listing_id, v_responder_listing_id)
      or responder_listing_id in (v_initiator_listing_id, v_responder_listing_id)
    );

  return true;
end;
$$;

revoke all on function public.accept_trade(uuid, uuid) from public;
grant execute on function public.accept_trade(uuid, uuid) to authenticated;
