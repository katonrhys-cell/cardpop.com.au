import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import supabase from '../../utils/supabaseClient.js';
import { generateOTP } from '../../utils/otpGenerator.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { authMiddleware } from '../../middleware/auth.js';
import { mfaLimiter } from '../../middleware/endpoint-rate-limit.js';
import logger from '../../utils/logger.js';

const router = express.Router();
const MFA_CODE_EXPIRY_MS = parseInt(process.env.MFA_CODE_EXPIRY_MS || '600000', 10);

/**
 * Constant-time comparison of two short secret strings. Falls back to a fixed
 * `false` on any length mismatch so attackers can't infer the code via timing.
 */
function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

router.post('/request', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  // The email is bound to the authenticated user, not taken from the request
  // body — trusting a body-supplied email would let a caller store an MFA
  // session against a mismatched address.
  const email = req.user.email;
  if (!email) return res.status(400).json({ error: 'No email on account' });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + MFA_CODE_EXPIRY_MS).toISOString();
  const mfaId = `mfa_${crypto.randomBytes(16).toString('hex')}`;
  const encryptedOtp = encrypt({ code: otp, expiresAt });

  const { error } = await supabase.from('mfa_sessions').insert({
    user_id: userId,
    email,
    mfa_id: mfaId,
    encrypted_otp: encryptedOtp,
    expires_at: expiresAt,
    verified: false,
  });

  if (error) throw error;

  logger.info(`MFA request created for user ${userId}`);
  res.json({ mfaId, expiresAt, message: 'OTP sent to email' });
});

router.post('/verify', authMiddleware, mfaLimiter, async (req, res) => {
  const { mfaId, code } = req.body;
  if (!mfaId || !code) return res.status(400).json({ error: 'mfaId and code are required' });
  if (code.length !== 8) return res.status(400).json({ error: 'Code must be 8 digits' });

  const { data: mfaRecord, error } = await supabase
    .from('mfa_sessions')
    .select('*')
    .eq('mfa_id', mfaId)
    .eq('user_id', req.user.id) // scope to the caller — prevents operating on another user's MFA session (IDOR)
    .single();

  // Expected failures return proper status codes — never throw (which would
  // surface as a 500 and, in non-prod, leak internals via the error handler).
  if (error || !mfaRecord) return res.status(404).json({ error: 'MFA session not found' });
  // Reject replays: a session that has already been consumed can't be reused.
  if (mfaRecord.verified) return res.status(400).json({ error: 'MFA code already used' });
  if (new Date() > new Date(mfaRecord.expires_at)) return res.status(400).json({ error: 'MFA code expired' });

  const decrypted = decrypt(mfaRecord.encrypted_otp);
  if (!timingSafeEqualStr(decrypted.code, code)) return res.status(401).json({ error: 'Invalid MFA code' });

  const [profileResult, mfaResult] = await Promise.all([
    supabase.from('profiles').update({ mfa_enabled: true }).eq('id', mfaRecord.user_id),
    // Mark verified AND clear the OTP so the code can never be replayed.
    supabase.from('mfa_sessions').update({ verified: true, encrypted_otp: null }).eq('id', mfaRecord.id),
  ]);

  // Audit logging is best-effort and must not block or fail the request.
  supabase.from('audit_logs').insert({
    user_id: mfaRecord.user_id,
    event_type: 'mfa_verified',
    description: 'MFA verification successful',
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  }).catch(() => {});

  if (profileResult.error) throw profileResult.error;
  if (mfaResult.error) throw mfaResult.error;

  logger.info(`MFA verified for user ${mfaRecord.user_id}`);
  res.json({ success: true, message: 'MFA verified successfully' });
});

export default router;
