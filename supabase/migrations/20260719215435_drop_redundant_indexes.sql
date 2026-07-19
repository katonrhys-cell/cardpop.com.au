-- Drop redundant indexes (the safe subset of advisor 0005_unused_index).
--
-- Each index below indexes a column list that is a leading prefix of another
-- index on the same table (usually a unique constraint), so the wider index
-- already serves the same lookups — including the foreign-key check that the
-- single-column index was covering. Dropping the narrower one removes duplicate
-- write overhead with no loss of query capability, and is safe regardless of
-- usage statistics (unlike the ~125 purely usage-based "unused" indexes, which
-- are deliberately left in place: on this low-traffic DB dropping those has
-- negligible benefit, some risk, and would fight the FK indexes just added).
--
-- Format: <redundant index>  →  covered by <wider index>
--   idx_cmv_card_id                  → uq_card_market_valuations (card_id, …)
--   idx_collection_eras_slug         → idx_collection_eras_active (slug, …)
--   event_rsvps_event_id_idx         → event_rsvps_event_id_user_id_key (event_id, …)
--   idx_grading_verifications_number → unique_grading_verification (number, company)
--   idx_msl_source                   → uq_market_sold_listings (source, …)
--   notifications_is_read_idx        → notifications_user_unread_idx (user_id, is_read, …)
--   notifications_user_id_idx        → notifications_user_unread_idx (user_id, …)
--   reactions_user_id_idx            → reactions_user_id_comment_id_key (user_id, …)
--   reviews_seller_id_idx            → reviews_seller_id_visible_idx (seller_id, …)
--   set_cards_set_id_idx             → set_cards_set_id_card_number_variant_key (set_id, …)
--   set_completion_user_id_idx       → set_completion_user_id_set_card_id_key (user_id, …)
--   teams_franchise_id_idx           → teams_franchise_id_slug_key (franchise_id, …)
--   watchlist_user_id_idx            → watchlist_user_id_listing_id_key (user_id, …)

drop index if exists public.idx_cmv_card_id;
drop index if exists public.idx_collection_eras_slug;
drop index if exists public.event_rsvps_event_id_idx;
drop index if exists public.idx_grading_verifications_number;
drop index if exists public.idx_msl_source;
drop index if exists public.notifications_is_read_idx;
drop index if exists public.notifications_user_id_idx;
drop index if exists public.reactions_user_id_idx;
drop index if exists public.reviews_seller_id_idx;
drop index if exists public.set_cards_set_id_idx;
drop index if exists public.set_completion_user_id_idx;
drop index if exists public.teams_franchise_id_idx;
drop index if exists public.watchlist_user_id_idx;
