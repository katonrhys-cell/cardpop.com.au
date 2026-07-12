-- Guest checkout: shop & marketplace purchases no longer require an account.
--
-- A guest order has no registered buyer, so buyer_id must be nullable and we
-- capture the email they entered at checkout (for the receipt and, if they
-- opted in, the newsletter). Registered buyers are unaffected — buyer_id is
-- still populated for them.
--
-- Idempotent and backward-compatible: it can land before the app that relies
-- on it. Re-running "drop not null" on an already-nullable column is a no-op.

alter table public.orders alter column buyer_id drop not null;

alter table public.orders add column if not exists buyer_email text;
