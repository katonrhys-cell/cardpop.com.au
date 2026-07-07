-- Performance: drop redundant duplicate indexes flagged by the Supabase linter
-- (0009_duplicate_index). Each pair below indexes the same column(s) on the same
-- table; keeping both just doubles write/maintenance cost for no read benefit.
-- None back a unique/primary constraint (verified), so dropping one of each pair
-- is safe. We keep the `<table>_<col>_idx` convention and drop the `idx_<table>_<col>` twin.

drop index if exists public.idx_orders_seller_id;              -- keep orders_seller_id_idx
drop index if exists public.idx_orders_status;                 -- keep orders_status_idx
drop index if exists public.idx_user_verifications_status;     -- keep user_verifications_status_idx
drop index if exists public.idx_user_verifications_user_id;    -- keep user_verifications_user_id_idx
