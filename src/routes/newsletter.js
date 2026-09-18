import logger from '../utils/logger.js';
import express from 'express';
import { subscribeToNewsletter } from '../utils/newsletter.js';
import { registerLaunchInterest, recordNewsletterSubscriber } from '../services/launchRegistrationService.js';
import { verifyRecaptchaToken } from '../utils/recaptcha.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/subscribe', optionalAuthMiddleware, async (req, res) => {
  const { email, firstName, recaptchaToken, list, source } = req.body;

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
    // The pre-launch landing modal registers early-access interest. Our own
    // launch_registrations table is the source of truth (it reserves Pro-level
    // access and sends the welcome email + PDF); Kit is a best-effort marketing
    // push on top, so a Kit outage/config gap never blocks the signup.
    if (list === 'launch') {
      await registerLaunchInterest({ email, firstName, source });
      // Awaited (not fire-and-forget) so it reliably completes on serverless,
      // but its failure is swallowed — the registration already succeeded.
      await subscribeToNewsletter(email, firstName, { list: 'launch' })
        .catch((e) => logger.error('[newsletter] launch Kit subscribe failed:', e));
      return res.status(200).json({ success: true });
    }

    // Kit is the marketing tool, but our own table is the record of who asked
    // to hear from us — a Kit outage, a plan lapse or a lost account must not
    // cost us the list. Best-effort and first, for the same reason the launch
    // branch persists before pushing to Kit: awaited (not fire-and-forget) so
    // it reliably completes on serverless, but a DB hiccup never costs the
    // visitor their subscription.
    await recordNewsletterSubscriber({ email, firstName })
      .catch((e) => logger.error('[newsletter] failed to record subscriber:', e));

    const result = await subscribeToNewsletter(email, firstName, {});
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
