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

router.post('/request', authMiddleware, async (req, res) => {
  const { email } = req.body;
  const userId = req.user.id;
  if (!email) return res.status(400).json({ error: 'email is required' });

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
    .single();

  // Expected failures return proper status codes — never throw (which would
  // surface as a 500 and, in non-prod, leak internals via the error handler).
  if (error || !mfaRecord) return res.status(404).json({ error: 'MFA session not found' });
  if (new Date() > new Date(mfaRecord.expires_at)) return res.status(400).json({ error: 'MFA code expired' });

  const decrypted = decrypt(mfaRecord.encrypted_otp);
  if (decrypted.code !== code) return res.status(401).json({ error: 'Invalid MFA code' });

  const [profileResult, mfaResult] = await Promise.all([
    supabase.from('profiles').update({ mfa_enabled: true }).eq('id', mfaRecord.user_id),
    supabase.from('mfa_sessions').update({ verified: true }).eq('id', mfaRecord.id),
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
