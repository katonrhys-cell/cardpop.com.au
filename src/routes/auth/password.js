import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import supabase from '../../utils/supabaseClient.js';
import { validatePassword } from '../../utils/passwordValidator.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireAal2 } from '../../middleware/requireAal2.js';
import { passwordChangeLimiter } from '../../middleware/endpoint-rate-limit.js';
import logger from '../../utils/logger.js';
import { OUTBOUND_TIMEOUT_MS } from '../../utils/outboundTimeouts.js';

const router = express.Router();

// Anon client used only for verifying current password during /change.
// This module is imported unconditionally by routes/index.js, so throwing here
// when the env var is missing used to take the ENTIRE API down at cold start.
// The anon key is public (it ships in every browser bundle — see
// lib/supabaseClient.js), so fall back the same way userScopedSupabase.js does.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://vrfsaazuqjxotnieqlkd.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_lHlLkeTfwzhWQ80Zz6pL6g_jc7Y8p33';
// No session persistence / refresh timers: this client only ever verifies a
// password and must not keep the resulting session (or a timer) alive.
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

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
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.hibp),
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

// NOTE: there is deliberately no /reset/request route here. The frontend
// requests resets straight from Supabase (AuthContext → resetPasswordForEmail
// with a Turnstile captchaToken). A server-side copy using the service-role
// client used to live here: GoTrue skips CAPTCHA for service-role requests, so
// it was a CAPTCHA-free way to fire reset emails at any address (email
// bombing), rate-limited only per IP. Removed — see SECURITY_AUDIT_2026-09-21.

// Change password for authenticated user
// MFA-enrolled users must be stepped up (AAL2) to change their password, and
// current-password guesses are capped per user (see passwordChangeLimiter).
router.post('/change', authMiddleware, requireAal2, passwordChangeLimiter, async (req, res) => {
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
  await supabase.from('user_security').update({ active_sessions: [] }).eq('user_id', req.user.id).then(() => {}, () => {});

  // Revoke every OTHER Supabase/GoTrue session for this user. Updating the
  // password does NOT invalidate existing refresh tokens on its own, so without
  // this an attacker holding a stolen session would keep refreshing after the
  // victim changes their password — defeating the main reason to change it.
  // Scope 'others' keeps the current session (the device the user just used to
  // change the password) while killing the rest. Best-effort: a failure here
  // must not fail the already-committed password change.
  const accessToken = req.headers.authorization?.slice(7);
  if (accessToken) {
    await supabase.auth.admin
      .signOut(accessToken, 'others')
      .then(() => {}, (err) => {
        logger.warn(`Failed to revoke other sessions after password change for user ${req.user.id}: ${err?.message || err}`);
      });
  }

  await supabase.from('audit_logs').insert({
    user_id: req.user.id,
    event_type: 'password_changed',
    description: 'Password changed successfully',
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
  }).then(() => {}, () => {});

  logger.info(`Password changed for user ${req.user.id}`);
  res.json({ success: true, message: 'Password changed successfully' });
});

export default router;
