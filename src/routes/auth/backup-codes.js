import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import supabase from '../../utils/supabaseClient.js';
import { generateBackupCodes } from '../../utils/otpGenerator.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireAal2 } from '../../middleware/requireAal2.js';
import { backupCodeLimiter } from '../../middleware/endpoint-rate-limit.js';
import logger from '../../utils/logger.js';

const router = express.Router();

/** Constant-time comparison of two strings; false on any length mismatch. */
function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Rotating backup codes is an MFA-recovery action — an AAL1 token (password
// only) must not be able to replace the codes of a user who enrolled MFA.
router.post('/generate', authMiddleware, requireAal2, async (req, res) => {
  const codes = generateBackupCodes(6);
  const encryptedCodes = encrypt({
    codes: codes.map(code => ({ code, used: false })),
    generatedAt: new Date().toISOString(),
  });

  // Upsert (not update): if no user_security row exists yet, a plain update
  // matches zero rows and silently succeeds, returning codes that were never
  // persisted — the user would then be locked out when verifying.
  const { error } = await supabase
    .from('user_security')
    .upsert({ user_id: req.user.id, backup_codes: encryptedCodes }, { onConflict: 'user_id' });

  if (error) throw error;

  logger.info(`Backup codes generated for user ${req.user.id}`);
  res.json({ codes, message: 'Backup codes generated. Save them in a secure location.' });
});

router.post('/verify', authMiddleware, backupCodeLimiter, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Backup code is required' });

  const { data: profile, error } = await supabase
    .from('user_security')
    .select('backup_codes')
    .eq('user_id', req.user.id)
    .single();

  if (error) throw error;
  // Expected failures return proper status codes rather than throwing (500/leak).
  if (!profile?.backup_codes) return res.status(404).json({ error: 'No backup codes found' });

  const decrypted = decrypt(profile.backup_codes);
  const codeEntry = decrypted.codes.find(c => timingSafeEqualStr(c.code, code) && !c.used);
  if (!codeEntry) return res.status(401).json({ error: 'Invalid or already used backup code' });

  const updatedEncrypted = encrypt({
    codes: decrypted.codes.map(c => c.code === codeEntry.code ? { ...c, used: true } : c),
    generatedAt: decrypted.generatedAt,
  });

  const { error: updateError } = await supabase
    .from('user_security')
    .update({ backup_codes: updatedEncrypted })
    .eq('user_id', req.user.id);

  if (updateError) throw updateError;

  logger.info(`Backup code verified for user ${req.user.id}`);
  res.json({ success: true, message: 'Backup code verified' });
});

export default router;
