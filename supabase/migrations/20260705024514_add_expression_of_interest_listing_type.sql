-- Add 'expression_of_interest' to the listing_type enum.
--
-- An "Expression of Interest" listing has no fixed price — the seller
-- publishes an indicative price range (see the companion migration that adds
-- price_min_aud / price_max_aud) and buyers make offers, which the seller can
-- accept, decline or counter.
--
-- This lives in its own migration because Postgres forbids USING a newly
-- added enum value inside the same transaction that added it — the companion
-- migration (which references the value) must run in a later transaction.

alter type public.listing_type add value if not exists 'expression_of_interest';
