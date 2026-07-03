import 'dotenv/config';
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { welcomeOfferIssueLimiter } from '../middleware/endpoint-rate-limit.js';
import logger from '../utils/logger.js';
import {
  issueWelcomeOffer,
  getWelcomeOffer,
  redeemTrial,
} from '../services/welcomeOfferService.js';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /issue
// Called fire-and-forget by the signup page right after registration. It is
// unauthenticated because when email confirmation is enabled the new user has
// no session yet. Abuse surface is small: the caller must know a valid, less
// than 48-hour-old auth user id (unguessable UUID), the offer and its email are
// strictly once-per-user, the recipient address comes from the auth record —
// never the request — and the endpoint is rate-limited per target user. The
// response is always generic so it can't be used to probe for accounts.
router.post('/issue', welcomeOfferIssueLimiter, async (req, res) => {
  const { userId } = req.body || {};
  if (typeof userId !== 'string' || !UUID_RE.test(userId.trim())) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    await issueWelcomeOffer(userId.trim());
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

// POST /redeem-trial — start the free selling trial with the emailed code.
router.post('/redeem-trial', authMiddleware, async (req, res) => {
  try {
    const result = await redeemTrial(req.user.id, req.body?.code);
    res.json({ success: true, ...result });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) {
      logger.error(`[WELCOME] /redeem-trial error: ${err.message}`);
      return res.status(500).json({ error: 'Could not redeem the code. Please try again.' });
    }
    res.status(code).json({ error: err.message });
  }
});

export default router;
