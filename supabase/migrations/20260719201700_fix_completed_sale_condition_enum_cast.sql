-- Fix: marking a listing as 'sold' failed with
--   "COALESCE types text and card_condition cannot be matched"
--
-- trg_record_completed_sale() inserts a row into completed_sales when a listing
-- transitions to 'sold'. Its grade fallback was COALESCE(vi.grade, vi.condition,
-- 'Raw'): vi.grade and the 'Raw' literal are text, but vi.condition is the
-- card_condition enum, and Postgres refuses to COALESCE across those types — so
-- the whole UPDATE aborted and no sale was ever recorded.
--
-- Cast the enum to text so all three arms share a type. completed_sales.grade is
-- text, so the result is stored unchanged.

CREATE OR REPLACE FUNCTION public.trg_record_completed_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only fire when status changes to 'sold'
  IF NEW.status = 'sold' AND (OLD.status IS DISTINCT FROM 'sold') THEN
    INSERT INTO public.completed_sales (
      card_id,
      vault_item_id,
      listing_id,
      grade,
      sale_price,
      currency,
      seller_id,
      sale_date
    )
    SELECT
      vi.cardsight_card_id,
      NEW.vault_item_id,
      NEW.id,
      COALESCE(vi.grade, vi.condition::text, 'Raw'),
      NEW.price_aud,
      'AUD',
      NEW.seller_id,
      now()
    FROM public.vault_items vi
    WHERE vi.id = NEW.vault_item_id;
  END IF;
  RETURN NEW;
END;
$function$;
