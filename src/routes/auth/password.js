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
const anonClient = createClient(
  process.env.SUPABASE_URL || 'https://odoglvswwymyjuwlonkf.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// Validate password strength (no auth required)
router.post('/validate', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required' });

  const validation = validatePassword(password);
  res.json({ isStrong: validation.isStrong, strengthScore: validation.strengthScore, missing: validation.missing });
});

// Request a password reset link
router.post('/reset/request', async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

  const trimmedEmail = email.trim().toLowerCase();
  logger.info(`Password reset requested for ${trimmedEmail}`);

  // Use Supabase's built-in password reset email
  const { error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: trimmedEmail,
    options: { redirectTo: `${process.env.APP_URL || 'https://cardpop.online'}/reset-password` },
  });

  if (error) {
    logger.warn(`Password reset failed for ${trimmedEmail}: ${error.message}`);
  } else {
    // Audit log (best-effort)
    const { data: { user } } = await supabase.auth.admin.getUserByEmail(trimmedEmail);
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
  await supabase.from('profiles').update({ active_sessions: [] }).eq('id', req.user.id).catch(() => {});

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
