import 'dotenv/config';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

async function verifyTradeAccess(req, res, next) {
  try {
    const isTradeRoute = req.path.toLowerCase().startsWith('/trade');
    if (!isTradeRoute) return next();

    logger.info(`[TRADE_ACCESS] Trade route: ${req.method} ${req.path}`);

    if (!req.user) {
      logger.warn(`[TRADE_ACCESS] Unauthenticated trade attempt: ${req.method} ${req.path}`);
      return res.status(401).json({ error: 'Authentication required to trade', code: 'UNAUTHENTICATED' });
    }

    const userId = req.user.id;

    // Check email verification via Supabase auth
    const isEmailVerified = req.user.email_confirmed_at != null;

    if (!isEmailVerified) {
      logger.warn(`[TRADE_ACCESS] Unverified user ${userId} attempted trade: ${req.method} ${req.path}`);

      await supabase.from('audit_logs').insert({
        user_id: userId,
        event_type: 'trade_attempt_unverified',
        description: `Unverified user attempted: ${req.method} ${req.path}`,
        ip_address: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        status: 'blocked',
      }).catch(() => {});

      return res.status(403).json({
        error: 'User must be verified to trade',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before trading.',
      });
    }

    // Selling/trading gate (matches the DB can_sell() rule): trading requires
    // BOTH Stripe Identity verification AND a card on file (so the per-trade
    // fee can always be collected — a trade has no sale proceeds to net it
    // from). Buying is unaffected (it never hits a /trade route).
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_verified, has_saved_card')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.is_verified !== true) {
      logger.warn(`[TRADE_ACCESS] ID-unverified user ${userId} attempted trade: ${req.method} ${req.path}`);

      await supabase.from('audit_logs').insert({
        user_id: userId,
        event_type: 'trade_attempt_id_unverified',
        description: `ID-unverified user attempted: ${req.method} ${req.path}`,
        ip_address: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        status: 'blocked',
      }).catch(() => {});

      return res.status(403).json({
        error: 'Identity verification is required to trade',
        code: 'IDENTITY_NOT_VERIFIED',
        message: 'Verify your identity (a quick ID + selfie check via Stripe) before trading.',
      });
    }

    if (profile?.has_saved_card !== true) {
      logger.warn(`[TRADE_ACCESS] Card-less user ${userId} attempted trade: ${req.method} ${req.path}`);

      await supabase.from('audit_logs').insert({
        user_id: userId,
        event_type: 'trade_attempt_no_card',
        description: `User without a card on file attempted: ${req.method} ${req.path}`,
        ip_address: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        status: 'blocked',
      }).catch(() => {});

      return res.status(403).json({
        error: 'A saved card is required to trade',
        code: 'CARD_REQUIRED',
        message: 'Add a card on file before trading. It is never charged until a trade or sale completes.',
      });
    }

    logger.info(`[TRADE_ACCESS] Verified user ${userId} allowed`);
    next();
  } catch (error) {
    logger.error('[TRADE_ACCESS] Middleware error:', error);
    return res.status(500).json({ error: 'Failed to verify trade access', code: 'VERIFICATION_ERROR' });
  }
}

export { verifyTradeAccess };
