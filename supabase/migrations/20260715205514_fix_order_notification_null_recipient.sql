-- Fix: guest / cart orders fail to insert because the order-created notification
-- trigger has no valid recipient.
--
-- notify_on_order_created() fires AFTER INSERT on public.orders and calls
-- create_notification() for both NEW.seller_id and NEW.buyer_id. Those columns
-- are NULL for the new cart-checkout flow:
--   - a cart order has no single seller  -> seller_id is null
--   - a guest checkout has no account    -> buyer_id is null
-- create_notification() inserts into notifications.user_id, which is NOT NULL,
-- so the notification insert raises
--   null value in column "user_id" of relation "notifications" ...
-- and — because the trigger runs in the same transaction as the order insert —
-- the whole order insert is rolled back. The backend surfaces this to the buyer
-- as "Could not record the order."
--
-- Only ever exercised now: the pending-order insert never ran in production
-- before, because a Stripe ui_mode error was failing checkout one step earlier.
--
-- Fix: skip each notification when its recipient id is null. Real marketplace
-- orders (which have a genuine seller_id and buyer_id) notify exactly as before;
-- cart and guest orders simply create no notification for the missing party.
-- Idempotent (create or replace) and behaviour-preserving for existing orders.

create or replace function public.notify_on_order_created()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
DECLARE v_card_name text;
BEGIN
  SELECT vi.card_name INTO v_card_name
  FROM listings l LEFT JOIN vault_items vi ON vi.id = l.vault_item_id
  WHERE l.id = NEW.listing_id;

  -- Marketplace seller notification — only when there is a seller (cart/shop
  -- orders carry a null seller_id).
  IF NEW.seller_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.seller_id, 'listing_sold',
      'Your card sold! 🎉',
      COALESCE(v_card_name, 'Your listing') || ' sold for $' || NEW.item_price_aud::text,
      '/transactions', NEW.id
    );
  END IF;

  -- Buyer notification — only for a registered buyer (guest checkout carries a
  -- null buyer_id; the guest gets their confirmation by email instead).
  IF NEW.buyer_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.buyer_id, 'order_update',
      'Purchase confirmed',
      'You purchased ' || COALESCE(v_card_name, 'a card') || ' for $' || NEW.item_price_aud::text,
      '/transactions', NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;
