// Reset seller Stripe Connect accounts so they re-onboard onto the current
// account shape.
//
// Controller properties (Managed Risk / Stripe-managed pricing / Express
// Dashboard) are fixed when a Stripe account is created — there is no API call
// that converts an existing account. An account created under the old
// `type: 'express'` shape stays platform-liable for unrecoverable negative
// balances for the life of that account. The only way to move a seller across
// is to throw the old account away and let them onboard a fresh one.
//
// That is only safe while the account has never handled money. This script
// refuses to touch an account that has, checking BOTH sides:
//
//   Database   — a non-zero wallet balance, or any order that records a payout
//                to this seller (stripe_transfer_id, or payout_status
//                transferred / wallet_credited, on the order row or inside an
//                order_items line).
//   Stripe     — a non-zero available/pending balance, or any transfer ever
//                sent to the account.
//
// A seller who clears all four has nothing to lose by re-onboarding beyond
// re-entering their KYC and bank details.
//
// Order of operations: the profile is cleared FIRST, then the Stripe account is
// deleted. If the delete fails, the leftover is a dangling Stripe account that
// nothing points at — harmless, and the seller can still onboard. Deleting
// first would risk the opposite: a profile pointing at an account that no
// longer exists, which breaks onboarding until someone fixes it by hand.
//
// Run this only AFTER the Managed Risk change is live in production —
// re-onboarding against the old build just creates another Express account.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   STRIPE_SECRET_KEY=<sk_...> \
//   node scripts/reset-seller-connect-accounts.mjs [--confirm] [--user <uuid>]
//
// Dry run by default — it reports what it would do and changes nothing.
// Pass --confirm to actually reset. --user limits it to a single profile.

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

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

const CONFIRM = process.argv.includes('--confirm');
const userFlag = process.argv.indexOf('--user');
const ONLY_USER = userFlag !== -1 ? process.argv[userFlag + 1] : null;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const stripe = new Stripe(STRIPE_KEY);

// Every order anywhere in the system that records money reaching a seller.
// Small by construction (only paid-out orders qualify), so it's cheaper to pull
// once and match in memory than to run a JSON containment query per seller.
async function ordersWithRecordedPayouts() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, seller_id, payout_status, stripe_transfer_id, order_items');
  if (error) throw new Error(`could not read orders: ${error.message}`);

  const PAID = ['transferred', 'wallet_credited'];
  return (data || []).filter(o => {
    if (o.stripe_transfer_id) return true;
    if (PAID.includes(o.payout_status)) return true;
    const lines = Array.isArray(o.order_items) ? o.order_items : [];
    return lines.some(l => l?.payout && PAID.includes(l.payout.status));
  });
}

function ordersTouching(paidOrders, userId) {
  return paidOrders.filter(o => {
    if (o.seller_id === userId) return true;
    const lines = Array.isArray(o.order_items) ? o.order_items : [];
    return lines.some(l => l?.seller_id === userId);
  });
}

// Stripe's own view: has this account ever held or received money? Checked
// independently of our database, because a transfer that our webhook failed to
// record would still leave the account un-deletable (and un-safe to discard).
async function stripeMoneyCheck(accountId) {
  const reasons = [];

  const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
  const nonZero = [...(balance.available || []), ...(balance.pending || [])]
    .filter(b => Number(b.amount) !== 0)
    .map(b => `${(b.amount / 100).toFixed(2)} ${String(b.currency).toUpperCase()}`);
  if (nonZero.length) reasons.push(`non-zero Stripe balance (${nonZero.join(', ')})`);

  const transfers = await stripe.transfers.list({ destination: accountId, limit: 1 });
  if (transfers.data.length) reasons.push(`has received transfers (e.g. ${transfers.data[0].id})`);

  return reasons;
}

const query = supabase
  .from('profiles')
  .select('id, display_name, stripe_connect_account_id, wallet_balance_aud')
  .not('stripe_connect_account_id', 'is', null);
if (ONLY_USER) query.eq('id', ONLY_USER);

const { data: sellers, error } = await query;
if (error) {
  console.error(`Could not read profiles: ${error.message}`);
  process.exit(1);
}

if (!sellers.length) {
  console.log('No profiles have a Stripe Connect account. Nothing to do.');
  process.exit(0);
}

console.log(`Found ${sellers.length} account(s)${CONFIRM ? '' : ' — DRY RUN, nothing will change'}\n`);

const paidOrders = await ordersWithRecordedPayouts();
let reset = 0;
let skipped = 0;
let failed = 0;

for (const seller of sellers) {
  const label = seller.display_name || seller.id;
  const accountId = seller.stripe_connect_account_id;
  const blockers = [];

  if (Number(seller.wallet_balance_aud) > 0) {
    blockers.push(`held wallet balance $${Number(seller.wallet_balance_aud).toFixed(2)}`);
  }
  const touched = ordersTouching(paidOrders, seller.id);
  if (touched.length) {
    blockers.push(`${touched.length} order(s) with a recorded payout (${touched.map(o => o.id).join(', ')})`);
  }

  try {
    blockers.push(...(await stripeMoneyCheck(accountId)));
  } catch (e) {
    console.error(`SKIP  ${label} (${accountId}) — could not verify with Stripe: ${e.message}`);
    failed++;
    continue;
  }

  if (blockers.length) {
    console.log(`SKIP  ${label} (${accountId}) — money has moved: ${blockers.join('; ')}`);
    skipped++;
    continue;
  }

  if (!CONFIRM) {
    console.log(`would reset ${label} (${accountId}) — clean, never handled money`);
    reset++;
    continue;
  }

  // Clear the profile first — see the note at the top about failure ordering.
  const { error: updErr } = await supabase
    .from('profiles')
    .update({
      stripe_connect_account_id: null,
      stripe_connect_onboarded: false,
      payout_name_mismatch: false,
    })
    .eq('id', seller.id)
    .eq('stripe_connect_account_id', accountId); // no-op if it changed under us

  if (updErr) {
    console.error(`FAIL  ${label} (${accountId}) — profile not cleared, Stripe account left intact: ${updErr.message}`);
    failed++;
    continue;
  }

  try {
    await stripe.accounts.del(accountId);
    console.log(`reset ${label} — cleared profile and deleted ${accountId}`);
  } catch (e) {
    // Non-fatal: the seller can already re-onboard. The old account is now
    // unreferenced and holds nothing, so it can be deleted from the dashboard.
    console.warn(`reset ${label} — profile cleared, but ${accountId} could not be deleted (delete it by hand): ${e.message}`);
  }
  reset++;
}

console.log(
  `\nDone. ${CONFIRM ? 'Reset' : 'Would reset'} ${reset}` +
    (skipped ? `, skipped ${skipped} with money history` : '') +
    (failed ? `, ${failed} failed` : '') +
    '.'
);
if (!CONFIRM && reset > 0) {
  console.log('Re-run with --confirm to apply. Sellers will need to redo KYC and bank details.');
}
