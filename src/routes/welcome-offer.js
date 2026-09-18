import 'dotenv/config';
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { welcomeOfferIssueLimiter } from '../middleware/endpoint-rate-limit.js';
import logger from '../utils/logger.js';
import { welcomeOfferUserId } from '../utils/welcomeOfferRequest.js';
import {
  issueWelcomeOffer,
  getWelcomeOffer,
  validateTrialCode,
} from '../services/welcomeOfferService.js';

const router = express.Router();

// POST /issue
// Two callers, either of which is enough on its own (the offer and its email
// are strictly once-per-user, so a double call is a no-op):
//
//   - the `profiles_welcome_offer` database webhook, which fires on every new
//     profile row. This is the one that actually guarantees delivery: it covers
//     OAuth sign-ups, which never run the signup page's post-registration code
//     and so went years without a welcome email, and it can't be skipped by a
//     visitor closing the tab mid-request.
//   - the signup page, fire-and-forget right after registration — kept because
//     it delivers within a second or two rather than on the webhook's schedule.
//
// It is unauthenticated because when email confirmation is enabled the new user
// has no session yet. Abuse surface is small: the caller must know a valid, less
// than 48-hour-old auth user id (unguessable UUID), the offer and its email are
// strictly once-per-user, the recipient address comes from the auth record —
// never the request — and the endpoint is rate-limited per target user. The
// response is always generic so it can't be used to probe for accounts.
router.post('/issue', welcomeOfferIssueLimiter, async (req, res) => {
  const userId = welcomeOfferUserId(req.body);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    await issueWelcomeOffer(userId);
  } catch (err) {
    // Log the real reason but never reveal whether the user exists.
    logger.warn(`[WELCOME] issue for ${userId} not completed: ${err.message}`);
  }
  res.json({ success: true });
});

// GET /mine — the authenticated user's own offer, for the account/checkout UI.
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const offer = await getWelcomeOffer(req.user.id);
    res.json({ offer });
  } catch (err) {
    logger.error(`[WELCOME] /mine error: ${err.message}`);
    res.status(500).json({ error: 'Failed to load welcome offer' });
  }
});

// POST /validate-trial — confirm the emailed code. The trial itself is then
// activated through the normal Stripe/PayPal card-on-file flow (no charge
// until the trial ends); the subscription webhooks consume the code's trial
// half once that subscription actually starts.
router.post('/validate-trial', authMiddleware, async (req, res) => {
  try {
    const result = await validateTrialCode(req.user.id, req.body?.code);
    res.json({ success: true, requiresPaymentMethod: true, ...result });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) {
      logger.error(`[WELCOME] /validate-trial error: ${err.message}`);
      return res.status(500).json({ error: 'Could not validate the code. Please try again.' });
    }
    res.status(code).json({ error: err.message });
  }
});

export default router;
