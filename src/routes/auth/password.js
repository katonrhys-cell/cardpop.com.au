import 'dotenv/config';
import express from 'express';
import pb from '../../utils/pocketbaseClient.js';
import { validatePassword } from '../../utils/passwordValidator.js';
import { authMiddleware } from '../../middleware/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();
const PASSWORD_RESET_EXPIRY_MS = parseInt(process.env.PASSWORD_RESET_EXPIRY_MS || '900000', 10);

router.post('/validate', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const validation = validatePassword(password);

  res.json({
    isStrong: validation.isStrong,
    strengthScore: validation.strengthScore,
    missing: validation.missing,
  });
});

router.post('/reset/request', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  logger.info(`Password reset requested for ${trimmedEmail}`);

  // Check if user exists
  let user;
  try {
    user = await pb.collection('users').getFirstListItem(`email = "${trimmedEmail}"`);
  } catch (error) {
    logger.warn(`Password reset requested for non-existent user: ${trimmedEmail}`);
    // Don't reveal if user exists or not (security best practice)
    return res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  }

  try {
    // Generate secure reset token
    const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS).toISOString();

    logger.debug(`Generated reset token for user ${user.id}: ${resetToken}`);

    // Create password reset token record in PocketBase
    const tokenRecord = await pb.collection('passwordResetTokens').create({
      userId: user.id,
      email: trimmedEmail,
      resetToken,
      expiresAt,
      isUsed: false,
    });

    logger.info(`Password reset token created for user ${user.id}`);

    // Log the reset request
    await pb.collection('auditLogs').create({
      userId: user.id,
      eventType: 'password_reset_requested',
      description: 'Password reset requested',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString(),
    });

    // PocketBase hooks will handle sending the email with the reset link
    // The hook should construct the reset URL like: {FRONTEND_URL}/reset-password?token={resetToken}
    logger.info(`Password reset email will be sent to ${trimmedEmail} via PocketBase hooks`);

    // Return success message (don't expose token in response)
    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    logger.error(`Error creating password reset token for ${trimmedEmail}:`, error);
    // Still return success to prevent user enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  }
});

router.post('/reset/verify', async (req, res) => {
  const { resetToken } = req.body;

  if (!resetToken || !resetToken.trim()) {
    return res.status(400).json({ error: 'Reset token is required' });
  }

  const trimmedToken = resetToken.trim();
  logger.debug(`Verifying reset token: ${trimmedToken}`);

  try {
    // Find the token record
    const tokenRecord = await pb.collection('passwordResetTokens').getFirstListItem(`resetToken = "${trimmedToken}"`);

    if (!tokenRecord) {
      logger.warn(`Reset token not found: ${trimmedToken}`);
      throw new Error('Invalid or expired reset token');
    }

    // Check if token has already been used
    if (tokenRecord.isUsed) {
      logger.warn(`Attempt to reuse reset token: ${trimmedToken}`);
      throw new Error('Reset token has already been used');
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expiresAt);

    if (now > expiresAt) {
      logger.warn(`Reset token expired: ${trimmedToken}`);
      throw new Error('Reset token has expired');
    }

    logger.info(`Reset token verified successfully for user ${tokenRecord.userId}`);

    res.json({
      success: true,
      message: 'Token is valid',
      userId: tokenRecord.userId,
    });
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`);
    throw error;
  }
});

router.post('/reset/complete', async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !resetToken.trim()) {
    return res.status(400).json({ error: 'Reset token is required' });
  }

  if (!newPassword || !newPassword.trim()) {
    return res.status(400).json({ error: 'New password is required' });
  }

  const trimmedToken = resetToken.trim();
  logger.debug(`Attempting to complete password reset with token: ${trimmedToken}`);

  // Validate password strength
  const validation = validatePassword(newPassword);
  if (!validation.isStrong) {
    logger.warn(`Password reset attempted with weak password`);
    return res.status(400).json({
      error: 'Password does not meet strength requirements',
      missing: validation.missing,
    });
  }

  try {
    // Find the token record
    const tokenRecord = await pb.collection('passwordResetTokens').getFirstListItem(`resetToken = "${trimmedToken}"`);

    if (!tokenRecord) {
      logger.warn(`Reset token not found in completion: ${trimmedToken}`);
      throw new Error('Invalid or expired reset token');
    }

    // Check if token has already been used
    if (tokenRecord.isUsed) {
      logger.warn(`Attempt to reuse reset token in completion: ${trimmedToken}`);
      throw new Error('Reset token has already been used');
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expiresAt);

    if (now > expiresAt) {
      logger.warn(`Reset token expired in completion: ${trimmedToken}`);
      throw new Error('Reset token has expired');
    }

    // Get the user
    const user = await pb.collection('users').getOne(tokenRecord.userId);

    if (!user) {
      logger.error(`User not found for password reset: ${tokenRecord.userId}`);
      throw new Error('User not found');
    }

    // Update password
    logger.info(`Updating password for user ${user.id}`);
    await pb.collection('users').update(tokenRecord.userId, {
      password: newPassword,
      passwordConfirm: newPassword,
    });

    // Mark token as used
    await pb.collection('passwordResetTokens').update(tokenRecord.id, { isUsed: true });

    // Clear all active sessions for security
    await pb.collection('users').update(tokenRecord.userId, {
      activeSessions: [],
    });

    // Log the password reset
    await pb.collection('auditLogs').create({
      userId: tokenRecord.userId,
      eventType: 'password_reset',
      description: 'Password reset completed successfully',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString(),
    });

    logger.info(`Password reset completed successfully for user ${tokenRecord.userId}`);

    res.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    logger.error(`Password reset completion error: ${error.message}`);
    throw error;
  }
});

router.post('/change', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !currentPassword.trim()) {
    return res.status(400).json({ error: 'Current password is required' });
  }

  if (!newPassword || !newPassword.trim()) {
    return res.status(400).json({ error: 'New password is required' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'New password must be different from current password' });
  }

  logger.info(`Password change requested for user ${req.user.id}`);

  // Validate new password strength
  const validation = validatePassword(newPassword);
  if (!validation.isStrong) {
    logger.warn(`Password change attempted with weak password for user ${req.user.id}`);
    return res.status(400).json({
      error: 'New password does not meet strength requirements',
      missing: validation.missing,
    });
  }

  try {
    // Verify current password
    await pb.collection('users').authWithPassword(req.user.email, currentPassword);
  } catch (error) {
    logger.warn(`Invalid current password for user ${req.user.id}`);
    throw new Error('Current password is incorrect');
  }

  try {
    // Update password
    logger.info(`Updating password for user ${req.user.id}`);
    await pb.collection('users').update(req.user.id, {
      password: newPassword,
      passwordConfirm: newPassword,
    });

    // Log the password change
    await pb.collection('auditLogs').create({
      userId: req.user.id,
      eventType: 'password_changed',
      description: 'Password changed successfully',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString(),
    });

    logger.info(`Password changed successfully for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error(`Password change error: ${error.message}`);
    throw error;
  }
});

export default router;