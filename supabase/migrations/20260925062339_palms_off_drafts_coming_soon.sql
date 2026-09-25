-- Show every Palms Off Gaming line in the shop as "Coming soon".
--
-- The wholesale range was seeded as `draft` (hidden). Moving it to
-- `coming_soon` makes it publicly visible with the enquiry button but never
-- purchasable (every checkout path requires `active`). Archived lines (#909)
-- stay archived. Idempotent: only rows still in draft are touched, so a line
-- an admin has since activated or archived is left alone.

update public.shop_products
set status = 'coming_soon', updated_at = now()
where brand = 'Palms Off Gaming'
  and status = 'draft';
