import { getPlatformSetting } from '../services/stripeWebhookService.js';
import logger from '../utils/logger.js';

// Blocks a buy/sell action when the platform requires a verified email and the
// authenticated user's address isn't confirmed. Mirrors verifyTradeAccess but
// is gated by the `email_verification_required` platform setting so an admin can
// switch it off. Must run AFTER authMiddleware (needs req.user with the raw
// Supabase user, including email_confirmed_at).
//
// Defaults to OFF when the setting row is absent, and fails OPEN on a read
// error: a missing/unreachable settings row must never silently block paying
// customers. Enforcement turns on only once an admin saves the flag as true.
export async function requireEmailVerified(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
    }

    const setting = await getPlatformSetting('email_verification_required', false);
    const required = setting === true || setting === 'true';
    if (!required) return next();

    if (req.user.email_confirmed_at != null) return next();

    logger.warn(`[VERIFY] Blocked unverified user ${req.user.id} at ${req.method} ${req.originalUrl}`);
    return res.status(403).json({
      error: 'Please verify your email address before you can buy or sell.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  } catch (err) {
    logger.error(`[VERIFY] email-verification gate failed open: ${err.message}`);
    return next();
  }
}
