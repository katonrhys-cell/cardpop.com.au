-- Lock the money/identity columns on public.offers against tampering via a
-- legitimate-looking UPDATE.
--
-- "Buyers can respond to countered offers" (20260705024521_expression_of_
-- interest_offers.sql) lets a buyer move their own countered offer to
-- accepted/declined, but its WITH CHECK only constrains `status` — nothing
-- stops the same request from also rewriting amount_aud/counter_amount_aud
-- (e.g. .update({ status: 'accepted', counter_amount_aud: 1 })), and the
-- base seller-counter policy (predates repo-tracked migrations) has the same
-- gap for buyer_id/seller_id/listing_id. A BEFORE UPDATE trigger enforces
-- the invariant regardless of which RLS policy let the UPDATE through,
-- mirroring the existing messages_prevent_content_change trigger
-- (20260628000001_secure_messages_rls.sql).
--
-- counter_amount_aud is the one field genuinely allowed to change once: the
-- seller sets it exactly during the pending -> countered transition. Once
-- set, it too becomes immutable — the buyer's later accept/decline update
-- must not be able to rewrite the agreed price.

create or replace function public.offers_prevent_price_tamper()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.buyer_id is distinct from old.buyer_id
     or new.seller_id is distinct from old.seller_id
     or new.listing_id is distinct from old.listing_id
     or new.amount_aud is distinct from old.amount_aud then
    raise exception 'offers: buyer_id, seller_id, listing_id and amount_aud cannot be changed after creation';
  end if;

  if new.counter_amount_aud is distinct from old.counter_amount_aud
     and not (old.status = 'pending' and new.status = 'countered' and old.counter_amount_aud is null) then
    raise exception 'offers: counter_amount_aud cannot be changed once set';
  end if;

  return new;
end;
$$;

drop trigger if exists offers_prevent_price_tamper on public.offers;
create trigger offers_prevent_price_tamper
before update on public.offers
for each row execute function public.offers_prevent_price_tamper();
