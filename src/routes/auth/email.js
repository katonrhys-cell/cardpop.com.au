import express from 'express';
import { supabase } from '../../utils/supabaseClient.js';
import logger from '../../utils/logger.js';
import { emailCheckLimiter } from '../../middleware/endpoint-rate-limit.js';

const router = express.Router();

// ─── POST /auth/email/exists ─────────────────────────────────────────────────
// Does a CardPop account already exist for this email? Powers the guest-checkout
// nudge that tells a returning customer to sign in instead of checking out as a
// guest. It deliberately reveals account existence (a standard checkout
// affordance) — mitigated by the IP rate limiter and by keeping the underlying
// auth.users read behind a service_role-only SECURITY DEFINER function, so it's
// never callable directly from the browser's anon key. Returns only a boolean.
router.post('/exists', emailCheckLimiter, async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@') || email.length > 254) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    const { data, error } = await supabase.rpc('email_has_account', { check_email: email });
    if (error) throw error;

    res.json({ exists: data === true });
  } catch (err) {
    logger.error(`[AUTH] email exists check failed: ${err.message}`);
    // Fail closed on the nudge (never falsely claim an account exists) but don't
    // surface a 500 — this is an optional affordance, not a checkout blocker.
    res.json({ exists: false });
  }
});

export default router;
