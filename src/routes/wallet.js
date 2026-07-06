import express from 'express';
import stripe from '../utils/stripeClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { ensureWalletCustomer, getWalletBalanceCents } from '../services/walletService.js';

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

export default router;
