-- Offers: each status move belongs to one side.
--
-- `offers_update_access` is one permissive UPDATE policy whose USING and
-- WITH CHECK are each an OR of branches, and Postgres evaluates the two
-- independently: the row only has to pass *some* USING branch before the write
-- and *some* WITH CHECK branch after it. So a buyer's own pending offer passed
-- USING through the "buyer may withdraw a pending offer" branch and WITH CHECK
-- through the "buyer may accept a counter" branch — i.e. a buyer could
--
--   PATCH /rest/v1/offers?id=eq.<their offer>  {"status":"accepted"}
--
-- with nothing but their own session, and `resolveOfferPrice()` then checked
-- them out at the amount they had offered. A $1 offer on any buy-now listing
-- (offers are on by default) bought the card for $1. Nothing recorded who made
-- the move: offers_enforce_lifecycle only looked at expiry, and
-- offers_prevent_price_tamper only froze the amounts.
--
-- The trigger now owns the state machine for buyers and sellers, mirroring
-- OFFER_ACTIONS in src/routes/offers.js:
--
--   seller:  pending   -> accepted | declined | countered
--   buyer:   pending   -> withdrawn
--            countered -> accepted | declined
--
-- Anything else from a signed-in caller is refused. The service role
-- (auth.uid() is null: the expiry sweep, the Stripe webhook) is unchanged.
-- The rest of the function is the body from
-- 20260929211351_offer_payment_deadline.sql, unmodified.

create or replace function public.offers_enforce_lifecycle()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  -- Buyers and sellers (auth.uid() set) never write lifecycle columns
  -- directly; the service role (webhook, expiry sweep) is trusted.
  if v_uid is not null then
    new.expires_at := old.expires_at;
    new.payment_due_at := old.payment_due_at;
    new.paid_at := old.paid_at;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Who may make which move. The seller is tested first and the buyer branch
  -- excludes the seller, so the two sets can never be combined by one caller.
  if v_uid is not null then
    if v_uid = old.seller_id
       and old.status = 'pending'
       and new.status in ('accepted', 'declined', 'countered') then
      null;
    elsif v_uid = old.buyer_id
       and v_uid is distinct from old.seller_id
       and (
         (old.status = 'pending' and new.status = 'withdrawn')
         or (old.status = 'countered' and new.status in ('accepted', 'declined'))
       ) then
      null;
    else
      raise exception 'offers: a % offer cannot be moved to % by this account', old.status, new.status
        using errcode = '42501';
    end if;
  end if;

  if v_uid is not null
     and old.status in ('pending', 'countered')
     and new.status in ('accepted', 'countered')
     and old.expires_at is not null
     and old.expires_at <= now() then
    raise exception 'This offer has expired' using errcode = '23514';
  end if;

  -- A counter is the seller's own binding proposal: the buyer gets a fresh
  -- 48 hours to accept it or let it lapse.
  if old.status = 'pending' and new.status = 'countered' then
    new.expires_at := now() + interval '48 hours';
  end if;

  -- Agreement reached: the buyer now has 48 hours to pay. (When the webhook
  -- records payment of a counter it sets paid_at in the same update, so no
  -- deadline is needed.)
  if new.status = 'accepted' and new.paid_at is null and new.payment_due_at is null then
    new.payment_due_at := now() + interval '48 hours';
  end if;

  if new.status in ('accepted', 'declined', 'countered') and new.responded_at is null then
    new.responded_at := now();
  end if;

  return new;
end;
$function$;

-- Say the same thing in the policy, so the rule is readable in one place and a
-- future trigger rewrite can't silently reopen it: USING and WITH CHECK are now
-- paired per actor instead of being two independent ORs. (The trigger is still
-- what ties the *old* status to the new one — a policy can't see both.)
drop policy if exists offers_update_access on public.offers;
create policy offers_update_access on public.offers
  for update to authenticated
  using (
    ((select auth.uid()) = seller_id and status = 'pending')
    or ((select auth.uid()) = buyer_id and status in ('pending', 'countered'))
  )
  with check (
    ((select auth.uid()) = seller_id and status in ('accepted', 'declined', 'countered'))
    or ((select auth.uid()) = buyer_id and status in ('accepted', 'declined', 'withdrawn'))
  );
