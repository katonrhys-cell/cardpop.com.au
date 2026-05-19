import 'dotenv/config';
import express from 'express';
import pb from '../../utils/pocketbaseClient.js';
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

  await pb.collection('users').update(req.user.id, {
    backupCodes: encryptedCodes,
  });

  logger.info(`Backup codes generated for user ${req.user.id}`);

  res.json({
    codes,
    message: 'Backup codes generated. Save them in a secure location.',
  });
});

router.post('/verify', authMiddleware, async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Backup code is required' });
  }

  const user = await pb.collection('users').getOne(req.user.id);

  if (!user.backupCodes) {
    throw new Error('No backup codes found');
  }

  const decrypted = decrypt(user.backupCodes);
  const codeEntry = decrypted.codes.find(c => c.code === code && !c.used);

  if (!codeEntry) {
    throw new Error('Invalid or already used backup code');
  }

  const updatedCodes = decrypted.codes.map(c =>
    c.code === code ? { ...c, used: true } : c
  );

  const updatedEncrypted = encrypt({
    codes: updatedCodes,
    generatedAt: decrypted.generatedAt,
  });

  await pb.collection('users').update(req.user.id, {
    backupCodes: updatedEncrypted,
  });

  logger.info(`Backup code verified for user ${req.user.id}`);

  res.json({
    success: true,
    message: 'Backup code verified',
  });
});

export default router;