-- Fix: "Purchase confirmed" fires on an abandoned checkout.
--
-- notify_on_order_created() ran AFTER INSERT on public.orders. The cart /
-- marketplace checkout inserts the order as `pending` *before* redirecting the
-- buyer to Stripe, so the buyer was told "Purchase confirmed" (and the seller
-- "Your card sold!") the moment they clicked checkout — whether or not they
-- ever paid. Every order currently in the table is a `pending` abandoned
-- session, and one of them produced exactly that notification.
--
-- Fix: notify on the transition *into* a paid status instead of on insert.
--   - cart / marketplace path: orders start `pending`, and the Stripe webhook
--     flips them to `payment_confirmed` once payment actually clears (UPDATE).
--   - single-item path: the webhook inserts the row already
--     `payment_confirmed` (INSERT).
-- Both are covered; an abandoned checkout that never leaves `pending` notifies
-- nobody, and a `payment_failed` / `cancelled` order notifies nobody.
--
-- Re-notification is guarded two ways: the UPDATE branch only fires on a
-- not-paid -> paid edge (so payment_confirmed -> shipped -> completed stays
-- quiet), and each recipient is skipped if a notification for this order
-- already exists (so a refunded -> payment_confirmed round trip, or an admin
-- flipping a status back and forth, can't re-announce the sale).

create or replace function public.notify_on_order_paid()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
DECLARE
  v_card_name text;
  v_paid       constant order_status[] :=
    array['payment_confirmed', 'shipped', 'delivered', 'completed']::order_status[];
BEGIN
  -- Not a paid order (pending / cancelled / payment_failed / refunded / disputed).
  IF NOT (NEW.status = ANY (v_paid)) THEN
    RETURN NEW;
  END IF;

  -- Already paid before this update — a later lifecycle step, not a new sale.
  IF TG_OP = 'UPDATE' AND OLD.status = ANY (v_paid) THEN
    RETURN NEW;
  END IF;

  SELECT vi.card_name INTO v_card_name
  FROM listings l LEFT JOIN vault_items vi ON vi.id = l.vault_item_id
  WHERE l.id = NEW.listing_id;

  -- Marketplace seller notification — only when there is a seller (cart/shop
  -- orders carry a null seller_id; those sellers are notified per line by the
  -- Stripe webhook, which is the only place the individual lines are known).
  IF NEW.seller_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.seller_id AND related_id = NEW.id AND type = 'listing_sold'
  ) THEN
    PERFORM create_notification(
      NEW.seller_id, 'listing_sold',
      'Your card sold! 🎉',
      COALESCE(v_card_name, 'Your listing') || ' sold for $'
        || to_char(NEW.item_price_aud, 'FM999999990.00'),
      '/transactions', NEW.id
    );
  END IF;

  -- Buyer notification — only for a registered buyer (guest checkout carries a
  -- null buyer_id; the guest gets their confirmation by email instead).
  IF NEW.buyer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.buyer_id AND related_id = NEW.id AND type = 'order_update'
  ) THEN
    PERFORM create_notification(
      NEW.buyer_id, 'order_update',
      'Purchase confirmed',
      CASE
        WHEN v_card_name IS NOT NULL
          THEN 'You purchased ' || v_card_name || ' for $'
               || to_char(NEW.item_price_aud, 'FM999999990.00')
        ELSE 'Your payment of $' || to_char(NEW.total_aud, 'FM999999990.00')
             || ' was successful.'
      END,
      '/transactions', NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;

drop trigger if exists on_order_created on public.orders;
drop trigger if exists on_order_paid on public.orders;

create trigger on_order_paid
  after insert or update of status on public.orders
  for each row execute function public.notify_on_order_paid();

drop function if exists public.notify_on_order_created();

-- Clean up notifications the old trigger already emitted for orders that were
-- never paid for. Scoped to the two types the trigger emits, and only where the
-- related order is still in a non-paid status — a "Purchase confirmed" for an
-- unpaid order is wrong by definition.
delete from public.notifications n
using public.orders o
where n.related_id = o.id
  and n.type in ('order_update', 'listing_sold')
  and n.title in ('Purchase confirmed', 'Your card sold! 🎉')
  and not (o.status = any (array['payment_confirmed', 'shipped', 'delivered', 'completed']::order_status[]));
