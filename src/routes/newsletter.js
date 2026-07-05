import logger from '../utils/logger.js';
import express from 'express';
import { subscribeToNewsletter } from '../utils/newsletter.js';
import { verifyRecaptchaToken } from '../utils/recaptcha.js';

const router = express.Router();

router.post('/subscribe', async (req, res) => {
  const { email, firstName, recaptchaToken, list } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  // Bot protection for the public newsletter form, which always sends a token.
  // Verified only when a token is supplied (and skipped automatically when
  // RECAPTCHA_SECRET_KEY is unset); trusted internal callers — e.g. the
  // signup opt-in behind its own captcha — may omit it and rely on the rate
  // limiter applied to this route.
  if (recaptchaToken) {
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
