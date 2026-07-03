import express from 'express';
import logger from '../utils/logger.js';
import { verifyRecaptchaToken } from '../utils/recaptcha.js';
import { subscribeToNewsletter } from '../utils/newsletter.js';

const router = express.Router();

/**
 * POST /recaptcha/verify
 *
 * Verifies a reCAPTCHA v2 token for flows that don't otherwise pass through
 * this backend — namely signup and login, which call Supabase Auth directly
 * from the browser. The client verifies here first, then proceeds only on
 * success.
 *
 * Body: { token: string, newsletter?: { email, firstName } }
 *
 * The optional `newsletter` payload lets the signup form fulfil its
 * "subscribe me" opt-in using the same human-verification round trip, so a
 * single checkbox covers both the signup gate and the newsletter subscription
 * (reCAPTCHA tokens are single-use, so they can't be verified twice).
 */
router.post('/verify', async (req, res) => {
  const { token, newsletter } = req.body || {};

  const captcha = await verifyRecaptchaToken(token, req.ip);
  if (!captcha.success) {
    return res.status(400).json({ error: 'reCAPTCHA verification failed. Please try again.' });
  }

  // Best-effort newsletter opt-in — never blocks or fails the verification.
  if (newsletter?.email && typeof newsletter.email === 'string' && newsletter.email.includes('@')) {
    try {
      await subscribeToNewsletter(newsletter.email, newsletter.firstName);
    } catch (err) {
      logger.error('[recaptcha] newsletter opt-in during verify failed:', err);
    }
  }

  return res.status(200).json({ success: true });
});

export default router;
