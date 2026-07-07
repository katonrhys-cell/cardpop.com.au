import logger from '../utils/logger.js';
import express from 'express';
import { subscribeToNewsletter } from '../utils/newsletter.js';
import { verifyRecaptchaToken } from '../utils/recaptcha.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/subscribe', optionalAuthMiddleware, async (req, res) => {
  const { email, firstName, recaptchaToken, list } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  // Bot protection for the public newsletter form. A signed-in caller (e.g. the
  // opt-in checkbox on signup, immediately after a Turnstile-gated account
  // creation) is proof enough of not being an anonymous script; anyone else
  // must supply a token that actually passes verification — a missing or
  // failing token is rejected, it no longer just falls through to the rate
  // limiter (verifyRecaptchaToken itself fails open only when
  // RECAPTCHA_SECRET_KEY is unset, e.g. in dev).
  if (!req.user) {
    const captcha = await verifyRecaptchaToken(recaptchaToken, req.ip);
    if (!captcha.success) {
      return res.status(400).json({ error: 'reCAPTCHA verification failed. Please try again.' });
    }
  }

  try {
    // Only 'launch' is a recognised alternate list; anything else falls
    // through to the default newsletter form.
    const result = await subscribeToNewsletter(email, firstName, {
      list: list === 'launch' ? 'launch' : undefined,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error('[newsletter] subscribe error:', err);
    return res.status(500).json({ error: 'Failed to connect to newsletter service.' });
  }
});

export default router;
