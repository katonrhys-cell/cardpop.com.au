import 'dotenv/config';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

/**
 * Middleware to verify user email before allowing trade operations
 * Checks if the request is for a trade endpoint and verifies email verification status
 * Logs unverified trade attempts to audit logs
 */
async function verifyTradeAccess(req, res, next) {
  try {
    // Check if this is a trade-related endpoint
    const isTradeRoute = req.path.toLowerCase().includes('trade');

    // If not a trade route, skip verification
    if (!isTradeRoute) {
      logger.debug(`[TRADE_ACCESS] Non-trade route: ${req.method} ${req.path}`);
      return next();
    }

    logger.info(`[TRADE_ACCESS] Trade route detected: ${req.method} ${req.path}`);

    // Check if user is authenticated
    if (!req.user) {
      logger.warn(`[TRADE_ACCESS] Trade attempt without authentication: ${req.method} ${req.path}`);
      return res.status(401).json({
        error: 'Authentication required to trade',
        code: 'UNAUTHENTICATED',
      });
    }

    const userId = req.user.id;
    const userEmail = req.user.email;

    logger.debug(`[TRADE_ACCESS] Verifying email for user ${userId} (${userEmail})`);

    // Get fresh user data from PocketBase to ensure we have latest verification status
    let user;
    try {
      user = await pb.collection('users').getOne(userId);
    } catch (error) {
      logger.error(`[TRADE_ACCESS] Error fetching user ${userId}:`, error);
      throw new Error('Failed to verify user status');
    }

    // Check if email is verified
    const isEmailVerified = user.emailVerified === true;

    if (!isEmailVerified) {
      logger.warn(`[TRADE_ACCESS] Trade attempt by unverified user ${userId} (${userEmail}): ${req.method} ${req.path}`);

      // Log the unverified trade attempt to audit logs
      try {
        await pb.collection('auditLogs').create({
          userId,
          eventType: 'trade_attempt_unverified',
          description: `Unverified user attempted to access trade endpoint: ${req.method} ${req.path}`,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          status: 'blocked',
          timestamp: new Date().toISOString(),
        });
        logger.info(`[TRADE_ACCESS] Audit log created for unverified trade attempt by user ${userId}`);
      } catch (auditError) {
        logger.error(`[TRADE_ACCESS] Failed to create audit log for user ${userId}:`, auditError);
        // Continue even if audit logging fails - don't block the response
      }

      return res.status(403).json({
        error: 'User must be verified to trade',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before trading. Check your inbox for a verification link.',
      });
    }

    logger.info(`[TRADE_ACCESS] Email verified for user ${userId} (${userEmail}) - allowing trade access`);

    // Email is verified, allow access
    next();
  } catch (error) {
    logger.error(`[TRADE_ACCESS] Middleware error:`, error);
    return res.status(500).json({
      error: 'Failed to verify trade access',
      code: 'VERIFICATION_ERROR',
    });
  }
}

export { verifyTradeAccess };