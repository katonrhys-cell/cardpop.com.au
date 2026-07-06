-- Buyer prepaid wallet / store credit.
--
-- The wallet balance itself is never stored in this database — it lives
-- entirely on the Stripe Customer object (customer.balance, credited/debited
-- through Stripe's Balance Transactions API in src/services/walletService.js).
-- CardPop doesn't run its own escrow/custody ledger for buyer funds, so Stripe
-- stays the single source of truth for the number. This column is only the
-- link from a profile to its Stripe Customer id.

alter table public.profiles
  add column if not exists stripe_customer_id text unique;
