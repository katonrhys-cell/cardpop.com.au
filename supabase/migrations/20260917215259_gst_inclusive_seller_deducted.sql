-- GST becomes inclusive, and is deducted from the seller.
--
-- Before: GST was ADDED to the buyer's bill (10% of item + commission) and kept
-- by CardPop in full. The seller received none of it and no part of it was
-- earmarked for the ATO, so the platform's "revenue" silently contained a tax
-- liability.
--
-- After: every price on CardPop is GST-inclusive, as Australian consumer prices
-- must be. Nothing is added to the buyer's bill. The GST inside the seller's
-- supply (their card + their postage) is deducted from their payout and
-- remitted by CardPop on their behalf; the GST inside CardPop's own supplies
-- (commission, payment processing) is inside money the platform already holds.
--
-- Applied to every seller and every transaction with no GST-registration test:
-- a deliberately conservative business decision so nothing is owed to the ATO
-- after the fact. Sellers are told before they list (see the listing form).

alter table public.orders
  add column if not exists seller_gst_aud   numeric(10,2) not null default 0,
  add column if not exists platform_gst_aud numeric(10,2) not null default 0;

comment on column public.orders.seller_gst_aud is
  'GST inside the seller''s supply (card + postage), deducted from seller_proceeds_aud and remitted by CardPop on their behalf. Part of gst_included_aud.';
comment on column public.orders.platform_gst_aud is
  'GST inside CardPop''s own supplies on this order (commission, payment processing). Already held by the platform; part of gst_included_aud.';
comment on column public.orders.gst_aud is
  'GST ADDED on top of the buyer''s bill. Always 0 from 2026-09 onward — prices are GST-inclusive. Historical rows may be non-zero. See gst_included_aud.';

-- The old "GST on the full sale price, added on top" switch. Prices are
-- inclusive now, so there is no base to choose and nothing reads this — the row
-- is left in place (deleting it would break an admin page mid-deploy) but
-- relabelled so nobody wires it back up.
update public.platform_settings
   set label = 'GST on Commission Only (retired)',
       description = 'No longer used. GST is inside every price and is split by who supplied what: the seller''s share is deducted from their payout, CardPop''s share is inside its own fees.',
       updated_at = now()
 where key = 'gst_on_commission_only';
