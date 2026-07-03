import logger from '../utils/logger.js';
import express from 'express';
import { subscribeToNewsletter } from '../utils/newsletter.js';
import { verifyRecaptchaToken } from '../utils/recaptcha.js';

const router = express.Router();

router.post('/subscribe', async (req, res) => {
  const { email, firstName, recaptchaToken } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  // Bot protection. Skipped automatically when RECAPTCHA_SECRET_KEY is unset.
  const captcha = await verifyRecaptchaToken(recaptchaToken, req.ip);
  if (!captcha.success) {
    return res.status(400).json({ error: 'reCAPTCHA verification failed. Please try again.' });
  }

  try {
    const result = await subscribeToNewsletter(email, firstName);
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
