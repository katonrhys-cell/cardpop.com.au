import express from 'express';
import stripe from '../utils/stripeClient.js';
import logger from '../utils/logger.js';
import { supabase } from '../utils/supabaseClient.js';
import { authMiddleware } from '../middleware/auth.js';
import { ensureWalletCustomer, getWalletBalanceCents } from '../services/walletService.js';
import { isStripeObjectMissing } from '../utils/stripeErrors.js';

const router = express.Router();

// Buyer prepaid wallet — funds only ever move through Stripe Checkout /
// Stripe's Customer Balance, never a CardPop-held ledger.
const MIN_TOPUP_AUD = 5;
const MAX_TOPUP_AUD = 500;

// ─── GET /balance ─────────────────────────────────────────────────────────────

router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const balanceCents = await getWalletBalanceCents(stripe, req.user.id);
    res.json({ balanceAud: balanceCents / 100 });
  } catch (err) {
    logger.error(`[WALLET] /balance error: ${err.message}`);
    res.status(500).json({ error: 'Could not load wallet balance' });
  }
});

// ─── POST /topup ──────────────────────────────────────────────────────────────
// Creates a Checkout Session for a card payment that credits the buyer's
// Stripe Customer Balance once the webhook confirms payment.

router.post('/topup', authMiddleware, async (req, res) => {
  try {
    const { amountAud, successUrl, cancelUrl } = req.body;
    const amount = Number(amountAud);

    if (!Number.isFinite(amount) || amount < MIN_TOPUP_AUD || amount > MAX_TOPUP_AUD) {
      return res.status(400).json({ error: `Top-up amount must be between $${MIN_TOPUP_AUD} and $${MAX_TOPUP_AUD} AUD` });
    }
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
    }

    const customerId = await ensureWalletCustomer(stripe, req.user.id, { email: req.user.email });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer: customerId,
      line_items: [{
        price_data: {
          currency: 'aud',
          product_data: { name: 'CardPop Wallet Top-up' },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: req.user.id, walletTopup: 'true' },
    });

    if (!session?.url) throw new Error('Stripe returned a session without a URL');

    logger.info(`[WALLET] Top-up session created: ${session.id} ($${amount} AUD, user ${req.user.id})`);
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    logger.error(`[WALLET] /topup error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /save-card ──────────────────────────────────────────────────────────
// Save a payment method on file WITHOUT charging it. Hobby users are encouraged
// to do this so checkout is one tap; the card is only ever charged when they
// actually buy. Uses a Stripe Checkout Session in `setup` mode, so no card data
// touches CardPop and the flow reuses the same hosted-redirect pattern as
// top-up / subscription checkout. The saved method is attached to the user's
// Stripe Customer and used for future purchases.

router.post('/save-card', authMiddleware, async (req, res) => {
  try {
    const { successUrl, cancelUrl } = req.body;
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
    }

    const customerId = await ensureWalletCustomer(stripe, req.user.id, { email: req.user.email });

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      payment_method_types: ['card'],
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: req.user.id, saveCard: 'true' },
    });

    if (!session?.url) throw new Error('Stripe returned a session without a URL');

    logger.info(`[WALLET] Save-card session created: ${session.id} (user ${req.user.id})`);
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    logger.error(`[WALLET] /save-card error: ${err.message}`);
    res.status(500).json({ error: 'Could not start card setup' });
  }
});

// ─── GET /payment-methods ─────────────────────────────────────────────────────
// The saved cards on the user's Stripe Customer (brand / last4 / expiry only —
// never full numbers). Returns an empty list if they have no customer yet.

router.get('/payment-methods', authMiddleware, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!profile?.stripe_customer_id) return res.json({ paymentMethods: [] });

    let methods;
    try {
      methods = await stripe.paymentMethods.list({
        customer: profile.stripe_customer_id,
        type: 'card',
        limit: 10,
      });
    } catch (err) {
      // Stale customer id (deleted, or from a previous Stripe account): treat
      // as "no saved cards" — the next save-card flow recreates the customer.
      if (!isStripeObjectMissing(err)) throw err;
      methods = { data: [] };
    }

    const paymentMethods = (methods?.data ?? []).map((pm) => ({
      id:       pm.id,
      brand:    pm.card?.brand || 'card',
      last4:    pm.card?.last4 || '••••',
      expMonth: pm.card?.exp_month || null,
      expYear:  pm.card?.exp_year || null,
    }));

    // Keep profiles.has_saved_card (which the can_sell gate reads) in sync with
    // the real Stripe state — self-heals if the setup webhook was missed or a
    // card was later removed. Best-effort; never fail the read over it.
    supabase.from('profiles')
      .update({ has_saved_card: paymentMethods.length > 0 })
      .eq('id', req.user.id)
      .then(({ error }) => { if (error) logger.warn(`[WALLET] has_saved_card sync failed for ${req.user.id}: ${error.message}`); })
      .catch(() => {});

    res.json({ paymentMethods });
  } catch (err) {
    logger.error(`[WALLET] /payment-methods error: ${err.message}`);
    res.status(500).json({ error: 'Could not load saved cards' });
  }
});

export default router;
