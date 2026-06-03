import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

const router = express.Router();

const verificationTokens = new Map();
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function storeToken(token, userId, email) {
  verificationTokens.set(token, { userId, email, expiresAt: Date.now() + TOKEN_EXPIRY_MS, used: false });
  logger.info(`[VERIFICATION] Token stored for user ${userId} (${email})`);
}

function verifyToken(token) {
  const data = verificationTokens.get(token);
  if (!data) return null;
  if (Date.now() > data.expiresAt || data.used) {
    verificationTokens.delete(token);
    return null;
  }
  return data;
}

function markTokenAsUsed(token) {
  const data = verificationTokens.get(token);
  if (data) data.used = true;
}

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

// POST /verify-email
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token?.trim()) return res.status(400).json({ error: 'Verification token is required' });

  const tokenData = verifyToken(token.trim());
  if (!tokenData) return res.status(400).json({ error: 'Invalid or expired verification token' });

  const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(tokenData.userId);
  if (userErr || !user) return res.status(404).json({ error: 'User not found' });

  // Mark profile as verified
  const { error } = await supabase
    .from('profiles')
    .update({ email_verified: true })
    .eq('id', tokenData.userId);

  if (error) {
    logger.error(`[VERIFICATION] Failed to update profile: ${error.message}`);
    return res.status(500).json({ error: 'Failed to verify email' });
  }

  markTokenAsUsed(token.trim());

  await supabase.from('audit_logs').insert({
    user_id: tokenData.userId,
    event_type: 'email_verified',
    description: 'Email verified successfully',
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    status: 'success',
  }).catch(() => {});

  logger.info(`[VERIFICATION] Email verified for user ${tokenData.userId}`);
  res.json({ success: true, message: 'Email verified successfully' });
});

// GET /verify-email/:token
router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;
  if (!token?.trim()) return res.status(400).json({ error: 'Token is required' });

  const tokenData = verifyToken(token.trim());
  if (!tokenData) {
    return res.redirect(`${process.env.APP_URL || 'https://cardpop.online'}/verification-failed`);
  }

  const { error } = await supabase
    .from('profiles')
    .update({ email_verified: true })
    .eq('id', tokenData.userId);

  if (error) {
    return res.redirect(`${process.env.APP_URL || 'https://cardpop.online'}/verification-failed`);
  }

  markTokenAsUsed(token.trim());

  await supabase.from('audit_logs').insert({
    user_id: tokenData.userId,
    event_type: 'email_verified',
    description: 'Email verified via link',
    status: 'success',
  }).catch(() => {});

  res.redirect(`${process.env.APP_URL || 'https://cardpop.online'}/account?verified=true`);
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
