import 'dotenv/config';
import express from 'express';
import supabase from '../../utils/supabaseClient.js';
import { generateBackupCodes } from '../../utils/otpGenerator.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { authMiddleware } from '../../middleware/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();

router.post('/generate', authMiddleware, async (req, res) => {
  const codes = generateBackupCodes(6);
  const encryptedCodes = encrypt({
    codes: codes.map(code => ({ code, used: false })),
    generatedAt: new Date().toISOString(),
  });

  const { error } = await supabase
    .from('profiles')
    .update({ backup_codes: encryptedCodes })
    .eq('id', req.user.id);

  if (error) throw error;

  logger.info(`Backup codes generated for user ${req.user.id}`);
  res.json({ codes, message: 'Backup codes generated. Save them in a secure location.' });
});

router.post('/verify', authMiddleware, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Backup code is required' });

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('backup_codes')
    .eq('id', req.user.id)
    .single();

  if (error) throw error;
  if (!profile?.backup_codes) throw new Error('No backup codes found');

  const decrypted = decrypt(profile.backup_codes);
  const codeEntry = decrypted.codes.find(c => c.code === code && !c.used);
  if (!codeEntry) throw new Error('Invalid or already used backup code');

  const updatedEncrypted = encrypt({
    codes: decrypted.codes.map(c => c.code === code ? { ...c, used: true } : c),
    generatedAt: decrypted.generatedAt,
  });

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ backup_codes: updatedEncrypted })
    .eq('id', req.user.id);

  if (updateError) throw updateError;

  logger.info(`Backup code verified for user ${req.user.id}`);
  res.json({ success: true, message: 'Backup code verified' });
});

export default router;
