-- Seller wallet balance.
--
-- The payout and dispute flows credit/debit a per-user wallet held on the
-- profile: payoutService.creditWallet adds a seller's proceeds and the dispute
-- clawback subtracts them, both through the atomic increment_wallet_balance()
-- function (added in the next migration, which updates this column). The
-- account UI (pages/account/AccountWallet.jsx, pages/UserBalancePage.jsx) and
-- connectService/payoutService all read profiles.wallet_balance_aud.
--
-- The column was referenced by that application code but no migration ever
-- created it, so this backfills the missing schema. Existing rows default to 0
-- (no balance owed), and NOT NULL keeps the increment function's
-- coalesce(..., 0) arithmetic total.

alter table public.profiles
  add column if not exists wallet_balance_aud numeric(12,2) not null default 0;
