import 'dotenv/config';
import express from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Google site verification file
router.get('/googlee177016f79225570.html', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send('google-site-verification: googlee177016f79225570.html');
});

// POST /send-verification-email
router.post('/send-verification-email', async (req, res) => {
  const { userId } = req.body;
  if (!userId?.trim()) return res.status(400).json({ error: 'userId is required' });

  const trimmedUserId = userId.trim();
  logger.info(`[VERIFICATION] Sending verification email for user ${trimmedUserId}`);

  // Fetch user from Supabase auth
  const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(trimmedUserId);
  if (userErr || !user) {
    logger.warn(`[VERIFICATION] User not found: ${trimmedUserId}`);
    return res.status(404).json({ error: 'User not found' });
  }

  // Use Supabase's built-in email verification
  const { error } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email: user.email,
    options: { redirectTo: `${process.env.APP_URL || 'https://cardpop.online'}/account` },
  });

  if (error) {
    logger.error(`[VERIFICATION] Failed to generate verification link: ${error.message}`);
    return res.status(500).json({ error: 'Failed to send verification email' });
  }

  await supabase.from('audit_logs').insert({
    user_id: trimmedUserId,
    event_type: 'verification_email_sent',
    description: 'Email verification link generated',
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
  }).catch(() => {});

  logger.info(`[VERIFICATION] Verification email sent for user ${trimmedUserId}`);
  res.json({ success: true, message: 'Verification email sent' });
});

// POST /resend-verification
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

  const trimmedEmail = email.trim().toLowerCase();

  const { error } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email: trimmedEmail,
    options: { redirectTo: `${process.env.APP_URL || 'https://cardpop.online'}/account` },
  });

  // Always return success to prevent email enumeration
  if (error) logger.warn(`[VERIFICATION] Failed resend for ${trimmedEmail}: ${error.message}`);

  res.json({ success: true, message: 'If this email is registered, a verification link has been sent.' });
});

export default router;
