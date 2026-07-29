import 'dotenv/config';
import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware } from '../middleware/auth.js';
import { resendVerificationLimiter } from '../middleware/endpoint-rate-limit.js';
import logger from '../utils/logger.js';

const router = express.Router();

// POST /send-verification-email
router.post('/send-verification-email', authMiddleware, async (req, res) => {
  const trimmedUserId = req.user.id;
  logger.info(`[VERIFICATION] Sending verification email for user ${trimmedUserId}`);

  // Fetch user from Supabase auth
  const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(trimmedUserId);
  if (userErr || !user) {
    logger.warn(`[VERIFICATION] User not found: ${trimmedUserId}`);
    return res.status(404).json({ error: 'User not found' });
  }

  // auth.resend actually dispatches the confirmation email via Supabase's
  // mailer — admin.generateLink (used previously) only RETURNS the link and
  // never sends anything, so this endpoint claimed success while no email
  // ever went out.
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: user.email,
    options: { emailRedirectTo: `${process.env.APP_URL || 'https://cardpop.com.au'}/account` },
  });

  if (error) {
    logger.error(`[VERIFICATION] Failed to send verification email: ${error.message}`);
    return res.status(500).json({ error: 'Failed to send verification email' });
  }

  await supabase.from('audit_logs').insert({
    user_id: trimmedUserId,
    event_type: 'verification_email_sent',
    description: 'Email verification link generated',
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
  }).then(() => {}, () => {});

  logger.info(`[VERIFICATION] Verification email sent for user ${trimmedUserId}`);
  res.json({ success: true, message: 'Verification email sent' });
});

// POST /verify-email — gate the profile-completion wizard on a verified email.
//
// The wizard (ProfileCompletionPage) writes to the caller's OWN profile row
// (RLS-scoped), so the correct gate is email verification of the logged-in
// account — there is no standalone email-token flow in the app, and nothing
// issues the URL token the page used to send. Authenticate and check the
// account's email is confirmed; the client attaches the Bearer token.
router.post('/verify-email', authMiddleware, async (req, res) => {
  if (!req.user?.email_confirmed_at) {
    return res.status(403).json({
      error: 'Please verify your email address first — check your inbox for the confirmation link.',
    });
  }
  res.json({ verified: true });
});

// POST /resend-verification
// Unauthenticated + sends an email → rate-limited per target email to prevent
// inbox bombing and email-quota abuse.
router.post('/resend-verification', resendVerificationLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

  const trimmedEmail = email.trim().toLowerCase();

  // auth.resend dispatches the email; admin.generateLink (used previously)
  // only returned the link without sending it.
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: trimmedEmail,
    options: { emailRedirectTo: `${process.env.APP_URL || 'https://cardpop.com.au'}/account` },
  });

  // Always return success to prevent email enumeration
  if (error) logger.warn(`[VERIFICATION] Failed resend for ${trimmedEmail}: ${error.message}`);

  res.json({ success: true, message: 'If this email is registered, a verification link has been sent.' });
});

export default router;
