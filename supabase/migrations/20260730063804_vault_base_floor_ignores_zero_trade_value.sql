-- Stop the vault base-value floor blocking cards that aren't up for trade.
--
-- trg_fn_vault_enforce_base_floor rejected any update where trade_value_aud
-- sat below the locked base value. A card that isn't offered for trade carries
-- a trade value of 0, and 0 is below every positive floor — so once a card had
-- a locked base value, every save failed with
--   "Trade value ($0.00) cannot be set below the locked base value ($40.00)."
-- even when the seller never touched the trade value at all.
--
-- The floor is meant to stop a card being *offered* for trade below its locked
-- valuation. Zero is not an offer, so it is skipped — matching the frontend
-- rule in utils/listingValidation.js, which has always guarded with `tv > 0`.
-- The estimated-value branch keeps enforcing on every value: that field is
-- required and represents the card's worth, not an optional offer.

create or replace function public.trg_fn_vault_enforce_base_floor()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Check admin status via profiles table
  SELECT COALESCE(is_admin, FALSE)
  INTO   v_is_admin
  FROM   profiles
  WHERE  id = auth.uid();

  IF NOT v_is_admin THEN
    -- Block direct changes to the locked value itself
    IF NEW.locked_base_value_aud IS DISTINCT FROM OLD.locked_base_value_aud THEN
      RAISE EXCEPTION 'Only administrators can modify the locked base value for a card.';
    END IF;

    -- Block lowering estimated_value below the floor
    IF OLD.locked_base_value_aud IS NOT NULL
       AND NEW.estimated_value_aud IS NOT NULL
       AND NEW.estimated_value_aud < OLD.locked_base_value_aud THEN
      RAISE EXCEPTION 'Estimated value ($%) cannot be set below the locked base value ($%). Contact support to dispute the valuation.',
        NEW.estimated_value_aud, OLD.locked_base_value_aud;
    END IF;

    -- Block lowering trade_value below the floor. Zero (and NULL) mean the card
    -- is not offered for trade, which is not a below-floor offer.
    IF OLD.locked_base_value_aud IS NOT NULL
       AND NEW.trade_value_aud IS NOT NULL
       AND NEW.trade_value_aud > 0
       AND NEW.trade_value_aud < OLD.locked_base_value_aud THEN
      RAISE EXCEPTION 'Trade value ($%) cannot be set below the locked base value ($%).',
        NEW.trade_value_aud, OLD.locked_base_value_aud;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
