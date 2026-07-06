import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// Buyer prepaid wallet / store credit.
//
// The balance is never stored in our database — it lives entirely on the
// Stripe Customer object (`customer.balance`, a signed integer in cents where
// negative means credit owed to the customer). CardPop isn't running its own
// escrow, so every read/write here goes straight through Stripe's Balance
// Transactions API and profiles.stripe_customer_id is only the link to which
// Stripe Customer a profile owns. Idempotency keys (not a local ledger table)
// guard against a retried webhook double-crediting or double-debiting.
// ─────────────────────────────────────────────────────────────────────────────

/** Idempotent: returns the profile's Stripe customer id, creating one if needed. */
export async function ensureWalletCustomer(stripe, userId, { email, displayName } = {}) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    name: displayName || undefined,
    metadata: { userId },
  });

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)
    .is('stripe_customer_id', null);

  if (updateErr) {
    logger.error(`[WALLET] Created Stripe customer ${customer.id} but failed to persist for user ${userId}: ${updateErr.message}`);
    throw new Error('Could not link Stripe customer');
  }

  // A concurrent call may have won the race to persist a different customer id
  // first (the .is('stripe_customer_id', null) guard above no-ops in that
  // case) — re-read so every caller converges on the same customer.
  const { data: fresh } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  return fresh?.stripe_customer_id || customer.id;
}

/** Current wallet balance in cents, read live from Stripe — never cached locally. */
export async function getWalletBalanceCents(stripe, userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.stripe_customer_id) return 0;

  const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
  if (customer.deleted) return 0;
  return Math.max(0, -(customer.balance || 0));
}

/** Adds store credit to a customer's wallet (e.g. after a successful top-up payment). */
export async function creditWallet(stripe, customerId, amountCents, description, idempotencyKey) {
  if (!(amountCents > 0)) return;
  await stripe.customers.createBalanceTransaction(
    customerId,
    { amount: -amountCents, currency: 'aud', description },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
}

/** Spends store credit from a customer's wallet (e.g. once a wallet-funded order completes). */
export async function debitWallet(stripe, customerId, amountCents, description, idempotencyKey) {
  if (!(amountCents > 0)) return;
  await stripe.customers.createBalanceTransaction(
    customerId,
    { amount: amountCents, currency: 'aud', description },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
}

/** Stripe webhook handler for a completed wallet top-up Checkout Session. */
export async function handleWalletTopup(session, stripe) {
  const userId = session.metadata?.userId;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const amountCents = session.amount_total || 0;

  if (!userId || !customerId || !(amountCents > 0)) {
    logger.error(`[WALLET] Invalid top-up session ${session.id} — missing userId/customer/amount`);
    return;
  }

  await creditWallet(stripe, customerId, amountCents, 'CardPop wallet top-up', `wallet-topup-${session.id}`);
  logger.info(`[WALLET] Credited $${(amountCents / 100).toFixed(2)} AUD to customer ${customerId} (user ${userId})`);

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'wallet_topup',
    title: 'Wallet Topped Up',
    body: `$${(amountCents / 100).toFixed(2)} AUD was added to your CardPop wallet.`,
  }).catch(() => {});
}
