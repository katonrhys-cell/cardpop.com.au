import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import supabase from '../../utils/supabaseClient.js';
import { validatePassword } from '../../utils/passwordValidator.js';
import { authMiddleware } from '../../middleware/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();
const PASSWORD_RESET_EXPIRY_MS = parseInt(process.env.PASSWORD_RESET_EXPIRY_MS || '900000', 10);

// Anon client used only for verifying current password during /change
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_ANON_KEY || !SUPABASE_URL) {
  throw new Error('SUPABASE_ANON_KEY and SUPABASE_URL environment variables are required');
}
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Validate password strength (no auth required)
router.post('/validate', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required' });

  const validation = validatePassword(password);
  res.json({ isStrong: validation.isStrong, strengthScore: validation.strengthScore, missing: validation.missing });
});

// Pwned-password check (k-anonymity proxy to HaveIBeenPwned's Pwned Passwords
// range API). Backfills Supabase's "leaked password protection" — a Pro-plan
// Auth feature — on the free plan. The client SHA-1s the candidate password
// locally and sends ONLY the first 5 hex chars of the hash; we forward that
// prefix to HIBP and return the raw suffix list for the client to match
// locally. The password and its full hash never reach this server. No auth:
// this runs during signup and password recovery, before a session exists.
router.get('/pwned-check', async (req, res) => {
  const prefix = String(req.query.prefix || '').toUpperCase();
  if (!/^[0-9A-F]{5}$/.test(prefix)) {
    return res.status(400).json({ error: 'A 5-character hex hash prefix is required' });
  }
  try {
    // Add-Padding makes HIBP pad the response with bogus entries so the
    // response size can't hint at how many real matches the prefix has.
    const hibp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'CardPop-PasswordCheck' },
    });
    if (!hibp.ok) {
      logger.warn(`[PWNED] range lookup returned ${hibp.status}`);
      return res.status(502).json({ error: 'Password check is temporarily unavailable' });
    }
    const text = await hibp.text();
    res.type('text/plain').send(text);
  } catch (err) {
    logger.warn(`[PWNED] range lookup failed: ${err.message}`);
    return res.status(502).json({ error: 'Password check is temporarily unavailable' });
  }
});

// Request a password reset link
router.post('/reset/request', async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

  const trimmedEmail = email.trim().toLowerCase();
  logger.info(`Password reset requested for ${trimmedEmail}`);

  // Use Supabase's built-in password reset email
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: trimmedEmail,
    options: { redirectTo: `${process.env.APP_URL || 'https://cardpop.com.au'}/reset-password` },
  });

  if (error) {
    logger.warn(`Password reset failed for ${trimmedEmail}: ${error.message}`);
  } else {
    // Audit log (best-effort). generateLink already returns the resolved user;
    // there is no supabase.auth.admin.getUserByEmail method.
    const user = data?.user;
    if (user) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        event_type: 'password_reset_requested',
        description: 'Password reset requested',
        ip_address: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
      }).catch(() => {});
    }
  }

  // Always return success to prevent user enumeration
  res.json({ success: true, message: 'If an account exists with this email, a password reset link has been sent.' });
});

// Change password for authenticated user
router.post('/change', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword?.trim()) return res.status(400).json({ error: 'Current password is required' });
  if (!newPassword?.trim()) return res.status(400).json({ error: 'New password is required' });
  if (currentPassword === newPassword) return res.status(400).json({ error: 'New password must be different from current password' });

  const validation = validatePassword(newPassword);
  if (!validation.isStrong) {
    return res.status(400).json({ error: 'New password does not meet strength requirements', missing: validation.missing });
  }

  // Verify current password using anon client
  const { error: verifyError } = await anonClient.auth.signInWithPassword({
    email: req.user.email,
    password: currentPassword.trim(),
  });
  if (verifyError) {
    logger.warn(`Invalid current password for user ${req.user.id}`);
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  // Update password using service role
  const { error: updateError } = await supabase.auth.admin.updateUserById(req.user.id, {
    password: newPassword.trim(),
  });
  if (updateError) throw updateError;

  // Clear active sessions for security
  await supabase.from('user_security').update({ active_sessions: [] }).eq('user_id', req.user.id).catch(() => {});

  await supabase.from('audit_logs').insert({
    user_id: req.user.id,
    event_type: 'password_changed',
    description: 'Password changed successfully',
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
  }).catch(() => {});

  logger.info(`Password changed for user ${req.user.id}`);
  res.json({ success: true, message: 'Password changed successfully' });
});

export default router;
