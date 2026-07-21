import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { isStripeObjectMissing } from '../utils/stripeErrors.js';

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

  // Validate a stored id before trusting it: it may have been minted on a
  // previous Stripe account (the platform switched accounts) or deleted, in
  // which case every downstream call would fail with "No such customer".
  // Self-heal by falling through to create a replacement.
  const staleId = profile?.stripe_customer_id || null;
  if (staleId) {
    try {
      const existing = await stripe.customers.retrieve(staleId);
      if (!existing?.deleted) return staleId;
    } catch (err) {
      if (!isStripeObjectMissing(err)) throw err;
    }
    logger.warn(`[WALLET] Stored Stripe customer ${staleId} for user ${userId} no longer exists — recreating`);
  }

  const customer = await stripe.customers.create({
    email,
    name: displayName || undefined,
    metadata: { userId },
  });

  // Guarded write: only replace the exact value we read (null, or the stale
  // id), so a concurrent call that already persisted a fresh id wins the race.
  let update = supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);
  update = staleId ? update.eq('stripe_customer_id', staleId) : update.is('stripe_customer_id', null);
  const { error: updateErr } = await update;

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

  let customer;
  try {
    customer = await stripe.customers.retrieve(profile.stripe_customer_id);
  } catch (err) {
    // Stale id (deleted, or from a previous Stripe account) = no credit.
    if (isStripeObjectMissing(err)) return 0;
    throw err;
  }
  if (customer.deleted) return 0;
  return Math.max(0, -(customer.balance || 0));
}

/**
 * Guard against wallet double-spend.
 *
 * A wallet coupon is sized from a live balance read at checkout-session creation
 * but only debited when the completion webhook fires. So a buyer could open
 * several checkouts (multiple tabs, or cart + single-item) that each carry a
 * full-balance coupon and complete them all, extracting more discount than their
 * balance at the platform's expense.
 *
 * Reject creating a new wallet-funded checkout while the customer still has an
 * OPEN wallet-funded session. This closes the practical exploit (sequentially
 * opened tabs). A sub-second concurrent race (two creations before either
 * session is listable) can still slip through — the post-completion
 * over-redemption alert in debitWalletForOrder remains the backstop for that.
 */
export async function assertNoOpenWalletCheckout(stripe, customerId) {
  if (!customerId) return;
  const open = await stripe.checkout.sessions.list({
    customer: customerId,
    status: 'open',
    limit: 100,
  });
  const hasOpenWalletSession = (open?.data ?? []).some(
    (s) => Number(s.metadata?.walletCents) > 0,
  );
  if (hasOpenWalletSession) {
    const err = new Error(
      'You already have a wallet-funded checkout in progress. Please complete or cancel it before starting another.',
    );
    err.statusCode = 409;
    throw err;
  }
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

/**
 * Webhook-side debit for a completed wallet-funded order.
 *
 * The coupon amount was decided at session-creation from a balance read, but a
 * buyer can open several checkouts (tabs / cart + single-item) before any
 * webhook fires — each carrying a full-balance coupon. The debit always posts
 * in full so the Stripe balance stays a truthful ledger (it goes positive =
 * customer owes), and when the balance couldn't cover it, admins are alerted
 * to recover the shortfall instead of the platform silently eating it.
 */
export async function debitWalletForOrder(stripe, customerId, amountCents, description, idempotencyKey) {
  if (!(amountCents > 0)) return;

  let availableCents = null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    availableCents = customer.deleted ? 0 : Math.max(0, -(customer.balance || 0));
  } catch (e) {
    logger.warn(`[WALLET] Could not read balance for ${customerId} before debit: ${e.message}`);
  }

  await debitWallet(stripe, customerId, amountCents, description, idempotencyKey);

  if (availableCents !== null && availableCents < amountCents) {
    const shortfall = amountCents - availableCents;
    logger.error(`[WALLET] Over-redemption on ${customerId}: debit ${amountCents}¢ exceeded balance ${availableCents}¢ (${description}) — shortfall ${shortfall}¢ needs recovery`);
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    if (admins?.length) {
      await supabase.from('notifications').insert(admins.map(a => ({
        user_id: a.id,
        type: 'wallet_over_redemption',
        title: 'Wallet over-redemption detected',
        body: `Customer ${customerId} redeemed $${(amountCents / 100).toFixed(2)} wallet credit with only $${(availableCents / 100).toFixed(2)} available (${description}). Shortfall $${(shortfall / 100).toFixed(2)} — review the customer's orders.`,
      }))).then(() => {}, () => {});
    }
  }
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
  }).then(() => {}, () => {});
}
