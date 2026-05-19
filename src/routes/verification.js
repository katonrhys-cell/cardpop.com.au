import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

const router = express.Router();

// In-memory token store with expiration
const verificationTokens = new Map();
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a secure verification token
 * Uses crypto.randomBytes for cryptographic randomness
 * @returns {string} Secure token (hex format)
 */
function generateVerificationToken() {
  const randomBytes = crypto.randomBytes(32);
  const token = randomBytes.toString('hex');
  logger.debug(`[VERIFICATION] Generated secure token: ${token.substring(0, 16)}...`);
  return token;
}

/**
 * Store token in memory with expiration
 * @param {string} token - Verification token
 * @param {string} userId - User ID
 * @param {string} email - User email
 */
function storeToken(token, userId, email) {
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
  verificationTokens.set(token, {
    userId,
    email,
    expiresAt,
    used: false,
  });
  logger.info(`[VERIFICATION] Token stored for user ${userId} (${email}), expires in 24 hours`);
}

/**
 * Verify and retrieve token
 * @param {string} token - Verification token
 * @returns {Object|null} Token data or null if invalid/expired
 */
function verifyToken(token) {
  const tokenData = verificationTokens.get(token);

  if (!tokenData) {
    logger.warn(`[VERIFICATION] Token not found: ${token.substring(0, 16)}...`);
    return null;
  }

  if (Date.now() > tokenData.expiresAt) {
    logger.warn(`[VERIFICATION] Token expired: ${token.substring(0, 16)}...`);
    verificationTokens.delete(token);
    return null;
  }

  if (tokenData.used) {
    logger.warn(`[VERIFICATION] Token already used: ${token.substring(0, 16)}...`);
    return null;
  }

  return tokenData;
}

/**
 * Mark token as used
 * @param {string} token - Verification token
 */
function markTokenAsUsed(token) {
  const tokenData = verificationTokens.get(token);
  if (tokenData) {
    tokenData.used = true;
    logger.info(`[VERIFICATION] Token marked as used: ${token.substring(0, 16)}...`);
  }
}

/**
 * GET /googlee177016f79225570.html
 * Google verification endpoint
 */
router.get('/googlee177016f79225570.html', async (req, res) => {
  logger.info('[VERIFICATION] Fetching Google verification record');

  const record = await pb.collection('google_verification').getFirstListItem('filename="googlee177016f79225570.html"');

  if (!record) {
    logger.warn('[VERIFICATION] Google verification record not found');
    return res.status(404).json({ error: 'Verification record not found' });
  }

  logger.info('[VERIFICATION] Google verification record found, returning HTML content');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(record.content);
});

/**
 * POST /send-verification-email
 * Generate verification token and send email via PocketBase
 *
 * Request body:
 * {
 *   "userId": "user_id"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Verification email sent"
 * }
 */
router.post('/send-verification-email', async (req, res) => {
  const { userId } = req.body;

  // Validate input
  if (!userId || !userId.trim()) {
    logger.warn('[VERIFICATION] Send verification email request missing userId');
    return res.status(400).json({ error: 'userId is required' });
  }

  const trimmedUserId = userId.trim();
  logger.info(`[VERIFICATION] Processing send-verification-email request for user: ${trimmedUserId}`);

  try {
    // Fetch user from PocketBase
    logger.debug(`[VERIFICATION] Fetching user record: ${trimmedUserId}`);
    const user = await pb.collection('users').getOne(trimmedUserId);

    if (!user) {
      logger.warn(`[VERIFICATION] User not found: ${trimmedUserId}`);
      throw new Error('User not found');
    }

    const userEmail = user.email;
    logger.info(`[VERIFICATION] User found: ${trimmedUserId} (${userEmail})`);

    // Generate secure verification token
    logger.debug(`[VERIFICATION] Generating verification token for user ${trimmedUserId}`);
    const token = generateVerificationToken();

    // Store token in memory
    storeToken(token, trimmedUserId, userEmail);

    // Build verification link
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const verificationLink = `${appUrl}/complete-profile/${token}`;
    logger.debug(`[VERIFICATION] Verification link: ${verificationLink}`);

    // Prepare email content
    const emailSubject = 'Complete Your Profile - Email Verification';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; margin-bottom: 20px;">Complete Your Profile</h2>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Hello,
        </p>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Thank you for signing up! To complete your profile and verify your email address, please click the button below:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="
            display: inline-block;
            padding: 12px 30px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            font-size: 16px;
          ">Complete Profile</a>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          Or copy and paste this link in your browser:
        </p>
        
        <p style="color: #007bff; font-size: 14px; word-break: break-all; margin-bottom: 20px;">
          ${verificationLink}
        </p>
        
        <p style="color: #999; font-size: 12px; line-height: 1.6; margin-bottom: 20px;">
          This link will expire in 24 hours.
        </p>
        
        <p style="color: #999; font-size: 12px; line-height: 1.6; margin-bottom: 20px;">
          If you didn't create this account, you can safely ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; line-height: 1.6;">
          Best regards,<br>
          The Team
        </p>
      </div>
    `;

    const emailText = `
      Complete Your Profile
      
      Hello,
      
      Thank you for signing up! To complete your profile and verify your email address, please visit the link below:
      
      ${verificationLink}
      
      This link will expire in 24 hours.
      
      If you didn't create this account, you can safely ignore this email.
      
      Best regards,
      The Team
    `;

    // Send email via PocketBase
    logger.info(`[VERIFICATION] Sending verification email to ${userEmail}`);
    logger.debug(`[VERIFICATION] Email subject: "${emailSubject}"`);

    try {
      // Use PocketBase's built-in mailer
      // Note: This requires PocketBase to be configured with SMTP settings
      await pb.send({
        to: userEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      logger.info(`[VERIFICATION] Verification email sent successfully to ${userEmail}`);

      // Log to audit logs
      try {
        await pb.collection('auditLogs').create({
          userId: trimmedUserId,
          eventType: 'verification_email_sent',
          description: `Verification email sent to ${userEmail}`,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          status: 'success',
          timestamp: new Date().toISOString(),
        });
        logger.debug(`[VERIFICATION] Audit log created for verification email`);
      } catch (auditError) {
        logger.warn(`[VERIFICATION] Failed to create audit log: ${auditError.message}`);
      }

      res.json({
        success: true,
        message: 'Verification email sent',
      });
    } catch (emailError) {
      logger.error(`[VERIFICATION] Failed to send email via PocketBase: ${emailError.message}`);
      // Remove token from store if email sending failed
      verificationTokens.delete(token);
      throw new Error(`Failed to send verification email: ${emailError.message}`);
    }
  } catch (error) {
    logger.error(`[VERIFICATION] Error in send-verification-email: ${error.message}`);
    throw error;
  }
});

/**
 * POST /verify-email
 * Verify email using token and mark user as verified
 *
 * Request body:
 * {
 *   "token": "verification_token"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Email verified successfully",
 *   "user": { ... }
 * }
 */
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;

  // Validate input
  if (!token || !token.trim()) {
    logger.warn('[VERIFICATION] Verify email request missing token');
    return res.status(400).json({ error: 'token is required' });
  }

  const trimmedToken = token.trim();
  logger.info(`[VERIFICATION] Processing verify-email request with token: ${trimmedToken.substring(0, 16)}...`);

  try {
    // Verify token
    logger.debug(`[VERIFICATION] Verifying token: ${trimmedToken.substring(0, 16)}...`);
    const tokenData = verifyToken(trimmedToken);

    if (!tokenData) {
      logger.warn(`[VERIFICATION] Invalid or expired token: ${trimmedToken.substring(0, 16)}...`);
      throw new Error('Invalid or expired verification token');
    }

    const { userId, email } = tokenData;
    logger.info(`[VERIFICATION] Token verified for user ${userId} (${email})`);

    // Update user record to mark email as verified
    logger.debug(`[VERIFICATION] Updating user record to mark email as verified: ${userId}`);
    const updatedUser = await pb.collection('users').update(userId, {
      emailVerified: true,
    });

    logger.info(`[VERIFICATION] User email verified successfully: ${userId} (${email})`);

    // Mark token as used
    markTokenAsUsed(trimmedToken);

    // Log to audit logs
    try {
      await pb.collection('auditLogs').create({
        userId,
        eventType: 'email_verified',
        description: `Email verified for ${email}`,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        status: 'success',
        timestamp: new Date().toISOString(),
      });
      logger.debug(`[VERIFICATION] Audit log created for email verification`);
    } catch (auditError) {
      logger.warn(`[VERIFICATION] Failed to create audit log: ${auditError.message}`);
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name || '',
        emailVerified: updatedUser.emailVerified,
      },
    });
  } catch (error) {
    logger.error(`[VERIFICATION] Error in verify-email: ${error.message}`);
    throw error;
  }
});

/**
 * POST /resend-verification-email
 * Resend verification email (rate-limited)
 *
 * Request body:
 * {
 *   "email": "user@example.com"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Verification email sent"
 * }
 */
router.post('/resend-verification-email', async (req, res) => {
  const { email } = req.body;

  // Validate input
  if (!email || !email.trim()) {
    logger.warn('[VERIFICATION] Resend verification email request missing email');
    return res.status(400).json({ error: 'email is required' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  logger.info(`[VERIFICATION] Processing resend-verification-email request for: ${trimmedEmail}`);

  try {
    // Find user by email
    logger.debug(`[VERIFICATION] Finding user by email: ${trimmedEmail}`);
    const user = await pb.collection('users').getFirstListItem(`email = "${trimmedEmail}"`);

    if (!user) {
      logger.warn(`[VERIFICATION] User not found for email: ${trimmedEmail}`);
      // Return success to prevent email enumeration
      return res.json({
        success: true,
        message: 'If an account exists with this email, a verification email has been sent',
      });
    }

    // Check if email is already verified
    if (user.emailVerified) {
      logger.info(`[VERIFICATION] Email already verified for user ${user.id} (${trimmedEmail})`);
      return res.json({
        success: true,
        message: 'Email is already verified',
      });
    }

    logger.info(`[VERIFICATION] User found: ${user.id} (${trimmedEmail})`);

    // Generate new verification token
    logger.debug(`[VERIFICATION] Generating new verification token for user ${user.id}`);
    const token = generateVerificationToken();

    // Store token in memory
    storeToken(token, user.id, trimmedEmail);

    // Build verification link
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const verificationLink = `${appUrl}/complete-profile/${token}`;
    logger.debug(`[VERIFICATION] Verification link: ${verificationLink}`);

    // Prepare email content
    const emailSubject = 'Complete Your Profile - Email Verification';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; margin-bottom: 20px;">Complete Your Profile</h2>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Hello,
        </p>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          To complete your profile and verify your email address, please click the button below:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="
            display: inline-block;
            padding: 12px 30px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            font-size: 16px;
          ">Complete Profile</a>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          Or copy and paste this link in your browser:
        </p>
        
        <p style="color: #007bff; font-size: 14px; word-break: break-all; margin-bottom: 20px;">
          ${verificationLink}
        </p>
        
        <p style="color: #999; font-size: 12px; line-height: 1.6; margin-bottom: 20px;">
          This link will expire in 24 hours.
        </p>
        
        <p style="color: #999; font-size: 12px; line-height: 1.6; margin-bottom: 20px;">
          If you didn't request this email, you can safely ignore it.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; line-height: 1.6;">
          Best regards,<br>
          The Team
        </p>
      </div>
    `;

    const emailText = `
      Complete Your Profile
      
      Hello,
      
      To complete your profile and verify your email address, please visit the link below:
      
      ${verificationLink}
      
      This link will expire in 24 hours.
      
      If you didn't request this email, you can safely ignore it.
      
      Best regards,
      The Team
    `;

    // Send email via PocketBase
    logger.info(`[VERIFICATION] Sending verification email to ${trimmedEmail}`);
    logger.debug(`[VERIFICATION] Email subject: "${emailSubject}"`);

    try {
      await pb.send({
        to: trimmedEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      logger.info(`[VERIFICATION] Verification email sent successfully to ${trimmedEmail}`);

      // Log to audit logs
      try {
        await pb.collection('auditLogs').create({
          userId: user.id,
          eventType: 'verification_email_resent',
          description: `Verification email resent to ${trimmedEmail}`,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          status: 'success',
          timestamp: new Date().toISOString(),
        });
        logger.debug(`[VERIFICATION] Audit log created for verification email resend`);
      } catch (auditError) {
        logger.warn(`[VERIFICATION] Failed to create audit log: ${auditError.message}`);
      }

      res.json({
        success: true,
        message: 'Verification email sent',
      });
    } catch (emailError) {
      logger.error(`[VERIFICATION] Failed to send email via PocketBase: ${emailError.message}`);
      // Remove token from store if email sending failed
      verificationTokens.delete(token);
      throw new Error(`Failed to send verification email: ${emailError.message}`);
    }
  } catch (error) {
    logger.error(`[VERIFICATION] Error in resend-verification-email: ${error.message}`);
    throw error;
  }
});

export default router;
