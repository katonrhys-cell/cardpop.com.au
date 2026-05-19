import 'dotenv/config';
import express from 'express';
import pb from '../../utils/pocketbaseClient.js';
import { generateOTP } from '../../utils/otpGenerator.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { authMiddleware } from '../../middleware/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();
const MFA_CODE_EXPIRY_MS = parseInt(process.env.MFA_CODE_EXPIRY_MS || '600000', 10);

router.post('/request', async (req, res) => {
  const { userId, email } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ error: 'userId and email are required' });
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + MFA_CODE_EXPIRY_MS).toISOString();
  const mfaId = `mfa_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const encryptedOtp = encrypt({ code: otp, expiresAt });

  const mfaRecord = await pb.collection('mfaSessions').create({
    userId,
    email,
    mfaId,
    encryptedOtp,
    expiresAt,
    verified: false,
  });

  logger.info(`MFA request created for user ${userId}`);

  res.json({
    mfaId: mfaRecord.mfaId,
    expiresAt,
    message: 'OTP sent to email',
  });
});

router.post('/verify', async (req, res) => {
  const { mfaId, code } = req.body;

  if (!mfaId || !code) {
    return res.status(400).json({ error: 'mfaId and code are required' });
  }

  if (code.length !== 8) {
    return res.status(400).json({ error: 'Code must be 8 digits' });
  }

  const mfaRecord = await pb.collection('mfaSessions').getFirstListItem(`mfaId = "${mfaId}"`);

  if (!mfaRecord) {
    throw new Error('MFA session not found');
  }

  if (new Date() > new Date(mfaRecord.expiresAt)) {
    throw new Error('MFA code expired');
  }

  const decrypted = decrypt(mfaRecord.encryptedOtp);

  if (decrypted.code !== code) {
    throw new Error('Invalid MFA code');
  }

  const user = await pb.collection('users').getOne(mfaRecord.userId);
  await pb.collection('users').update(mfaRecord.userId, { mfaEnabled: true });

  await pb.collection('mfaSessions').update(mfaRecord.id, { verified: true });

  await pb.collection('auditLogs').create({
    userId: mfaRecord.userId,
    eventType: 'mfa_verified',
    description: 'MFA verification successful',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
  });

  const authToken = await pb.collection('users').authWithPassword(user.email, user.password);

  logger.info(`MFA verified for user ${mfaRecord.userId}`);

  res.json({
    success: true,
    token: authToken.token,
    user: authToken.record,
  });
});

export default router;