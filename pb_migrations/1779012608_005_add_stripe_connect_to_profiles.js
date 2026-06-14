// Migration: Add Stripe Connect columns to profiles and orders tables
//
// profiles:
//   stripe_connect_account_id  TEXT     — Stripe Express account ID (acct_xxx)
//   stripe_connect_onboarded   BOOLEAN  — whether seller completed Stripe onboarding (DEFAULT FALSE)
//
// orders:
//   stripe_transfer_id  TEXT — Stripe transfer ID when payout made via Connect
//   payout_status       TEXT — 'transferred', 'wallet_credited', or null (pending)
//
// SQL to apply via Supabase dashboard or CLI:
//
// ALTER TABLE profiles
//   ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
//   ADD COLUMN IF NOT EXISTS stripe_connect_onboarded BOOLEAN DEFAULT FALSE;
//
// ALTER TABLE orders
//   ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
//   ADD COLUMN IF NOT EXISTS payout_status TEXT;

export const sql = `
-- profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded BOOLEAN DEFAULT FALSE;

-- orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_status TEXT;
`;
