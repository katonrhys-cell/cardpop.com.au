// One-off backfill that pre-creates a Stripe Connect Express account for every
// existing seller who doesn't have one yet.
//
// Normally an account is created lazily the first time a seller opens the payout
// onboarding flow (src/services/connectService.js → connectOnboard). This script
// creates the account *shell* ahead of time for sellers who never onboarded, so
// their `profiles.stripe_connect_account_id` is populated. It does NOT complete
// KYC/onboarding — the seller still has to submit their details via the account
// link before payouts are enabled (stripe_connect_onboarded stays false).
//
// The account shape is defined in exactly one place —
// src/utils/sellerAccountShape.js (buildSellerAccountParams) — so this backfill
// can never drift from the on-demand flow.
//
// Who counts as a "seller": by default, profiles entitled to sell
// (subscription_status in trialing/active/grandfathered, or an unexpired trial),
// mirroring the public.can_sell() database helper. Pass --all-with-listings to
// instead target only profiles that actually have a listing, or --every-profile
// to target every profile (rarely what you want — creates Stripe accounts for
// pure buyers too).
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   STRIPE_SECRET_KEY=<sk_...> \
//   node scripts/backfill-seller-connect-accounts.mjs [--dry-run] [--all-with-listings|--every-profile] [--limit N]
//
// Re-running is safe (idempotent): profiles that already have an account id are
// skipped and no Stripe call is made for them.

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { buildSellerAccountParams } from '../src/utils/sellerAccountShape.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}
if (!STRIPE_KEY) {
  console.error('Set STRIPE_SECRET_KEY (sk_test_… or sk_live_…) first.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const MODE = process.argv.includes('--every-profile')
  ? 'every-profile'
  : process.argv.includes('--all-with-listings')
    ? 'with-listings'
    : 'can-sell';
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = new Stripe(STRIPE_KEY);

// Entitled-to-sell statuses — keep in sync with public.can_sell() in
// supabase/migrations/20260701000001_add_subscription_trial.sql.
const ENTITLED_STATUSES = ['trialing', 'active', 'grandfathered'];

// Page through every seller that still needs an account, honouring the selected
// mode. Only columns we need are selected.
async function* sellersNeedingAccount() {
  const PAGE = 500;

  // For --all-with-listings we first collect the distinct seller ids that have a
  // listing, then filter the profile scan to them.
  let listingSellerIds = null;
  if (MODE === 'with-listings') {
    listingSellerIds = new Set();
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from('listings')
        .select('seller_id')
        .not('seller_id', 'is', null)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`listings scan: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const row of data) listingSellerIds.add(row.seller_id);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }

  let from = 0;
  for (;;) {
    let query = supabase
      .from('profiles')
      .select('id, email, display_name, full_name, subscription_status, trial_ends_at, stripe_connect_account_id')
      .is('stripe_connect_account_id', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);

    const { data, error } = await query;
    if (error) throw new Error(`profiles scan: ${error.message}`);
    if (!data || data.length === 0) return;

    for (const p of data) {
      if (MODE === 'can-sell' && !isEntitled(p)) continue;
      if (MODE === 'with-listings' && !listingSellerIds.has(p.id)) continue;
      yield p;
    }

    if (data.length < PAGE) return;
    from += PAGE;
  }
}

function isEntitled(p) {
  if (ENTITLED_STATUSES.includes(p.subscription_status)) return true;
  if (p.trial_ends_at && new Date(p.trial_ends_at).getTime() > Date.now()) return true;
  return false;
}

let scanned = 0;
let created = 0;
let failed = 0;

console.log(`Mode: ${MODE}${DRY_RUN ? ' (dry run — no accounts will be created)' : ''}`);

for await (const seller of sellersNeedingAccount()) {
  if (created >= LIMIT) {
    console.log(`Reached --limit ${LIMIT}; stopping.`);
    break;
  }
  scanned++;
  const label = seller.display_name || seller.full_name || seller.id;

  if (DRY_RUN) {
    console.log(`would create account for ${label} (${seller.id})`);
    created++;
    continue;
  }

  try {
    // Mirror the on-demand flow exactly (shared Express-account shape).
    const account = await stripe.accounts.create(
      buildSellerAccountParams(seller.id, {
        email: seller.email || undefined,
        displayName: seller.display_name || seller.full_name || undefined,
      })
    );

    const { error: updErr } = await supabase
      .from('profiles')
      .update({ stripe_connect_account_id: account.id, stripe_connect_onboarded: false })
      .eq('id', seller.id)
      .is('stripe_connect_account_id', null); // guard against a race with on-demand onboarding

    if (updErr) {
      // Account exists in Stripe but we couldn't record it — log the id so it can
      // be reconciled by hand rather than silently orphaned.
      console.error(`  FAILED to persist ${account.id} for ${seller.id}: ${updErr.message}`);
      failed++;
      continue;
    }

    console.log(`created ${account.id} for ${label} (${seller.id})`);
    created++;
  } catch (err) {
    console.error(`  FAILED for ${seller.id}: ${err.message}`);
    failed++;
  }
}

console.log(
  `\nDone. Scanned ${scanned} seller(s), ${DRY_RUN ? 'would create' : 'created'} ${created}` +
    (failed ? `, ${failed} failed` : '') +
    '.'
);
process.exit(failed ? 1 : 0);
