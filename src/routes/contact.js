import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendContactMessage } from '../utils/emailService.js';
import { verifyTurnstileToken } from '../utils/turnstile.js';

const router = Router();

const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const MAX = { name: 100, email: 254, subject: 150, message: 5000 };

// Contact messages go to the public contact address set under Admin → Platform
// Settings, falling back to the operational notification inbox, then a hard
// default so a message is never silently dropped. Never throws.
async function getContactRecipient() {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['contact_email', 'notification_email']);
    const byKey = Object.fromEntries((data || []).map(r => [r.key, r.value]));
    const contact = typeof byKey.contact_email === 'string' && byKey.contact_email.trim();
    const notif = typeof byKey.notification_email === 'string' && byKey.notification_email.trim();
    return contact || notif || 'support@cardpop.com.au';
  } catch (e) {
    logger.warn(`[CONTACT] Failed to resolve contact recipient: ${e.message}`);
    return 'support@cardpop.com.au';
  }
}

/**
 * POST /contact
 *
 * Delivers a contact-form submission to the support inbox via Resend. Replaces
 * the old mailto: flow, which silently did nothing for visitors without a
 * configured mail client. Public (no auth) — abuse is bounded by the apiLimiter
 * mount and a hidden honeypot field.
 */
router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();
  // Hidden field real users never see; a filled value means a bot. Accept
  // silently so the bot doesn't learn it was caught.
  const honeypot = String(req.body?.company || '').trim();
  if (honeypot) return res.status(200).json({ ok: true });

  if (name.length < 2 || !isEmail(email) || subject.length < 3 || message.length < 20) {
    return res.status(400).json({
      error: 'Please provide your name, a valid email, a subject, and a message of at least 20 characters.',
    });
  }
  if (name.length > MAX.name || email.length > MAX.email || subject.length > MAX.subject || message.length > MAX.message) {
    return res.status(400).json({ error: 'One or more fields exceed the maximum allowed length.' });
  }

  // Cloudflare Turnstile — fail-open until TURNSTILE_SECRET_KEY is set in Vercel,
  // then enforced. Honeypot + rate limiting still apply regardless.
  const captcha = await verifyTurnstileToken(req.body?.turnstileToken, req.ip);
  if (!captcha.success) {
    return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
  }

  try {
    const recipient = await getContactRecipient();
    const sent = await sendContactMessage({ to: recipient, name, email, subject, message });
    if (!sent) {
      // RESEND_API_KEY unset or the provider rejected the send.
      return res.status(502).json({
        error: 'We could not send your message right now. Please email support@cardpop.com.au directly.',
      });
    }
    logger.info(`[CONTACT] Message from ${email} → ${recipient}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error(`[CONTACT] send failed: ${err.message}`);
    return res.status(500).json({
      error: 'Something went wrong sending your message. Please try again or email support@cardpop.com.au.',
    });
  }
});

export default router;
