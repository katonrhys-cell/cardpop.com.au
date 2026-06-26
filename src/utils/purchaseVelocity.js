import supabase from './supabaseClient.js';
import logger from './logger.js';

// New-account purchase velocity limits — a fraud control for the classic
// stolen-card cashout / card-testing pattern (a fresh account placing large or
// rapid-fire orders). Trusted accounts (identity-verified, or simply older than
// the new-account window) are never limited. The caps below are intentionally
// generous so they don't get in a real new buyer's way; they only stop the
// obviously-abusive end of the distribution. Verifying identity lifts them.

const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // "new" = < 7 days old
const VELOCITY_WINDOW_MS = 24 * 60 * 60 * 1000;        // rolling 24h

export const VELOCITY_LIMITS = {
  perOrderAud: 1500,    // a single order can't exceed this for a new account
  ordersPer24h: 5,      // max orders in a rolling 24h
  spendPer24hAud: 3000, // max total spend in a rolling 24h
};

// Orders in these states don't count toward velocity (no money actually moved /
// the purchase was reversed).
const NON_COUNTING_STATUSES = new Set(['payment_failed', 'cancelled', 'canceled', 'refunded']);

/**
 * @returns {Promise<{ allowed: true } | { allowed: false, reason: string, message: string }>}
 */
export async function checkPurchaseVelocity({ userId, orderValueAud }) {
  // Fail OPEN: a velocity-check outage must not block all checkouts. Any error
  // below returns allowed:true (logged), so payments keep working.
  try {
    const value = Number(orderValueAud) || 0;

    const { data: profile } = await supabase
      .from('profiles')
      .select('created_at, is_verified, verification_status')
      .eq('id', userId)
      .maybeSingle();

    const isVerified =
      profile?.is_verified === true || profile?.verification_status === 'approved';
    const ageMs = profile?.created_at
      ? Date.now() - new Date(profile.created_at).getTime()
      : Number.POSITIVE_INFINITY;
    const isNewAccount = ageMs < NEW_ACCOUNT_WINDOW_MS;

    // Trusted: verified, or past the new-account window.
    if (isVerified || !isNewAccount) return { allowed: true };

    if (value > VELOCITY_LIMITS.perOrderAud) {
      return {
        allowed: false,
        reason: 'per_order',
        message: `New accounts are limited to orders under $${VELOCITY_LIMITS.perOrderAud} AUD. Verify your identity to lift this limit.`,
      };
    }

    const since = new Date(Date.now() - VELOCITY_WINDOW_MS).toISOString();
    const { data: recent } = await supabase
      .from('orders')
      .select('total_aud, status')
      .eq('buyer_id', userId)
      .gte('created_at', since);

    const counting = (recent || []).filter((o) => !NON_COUNTING_STATUSES.has(o.status));
    const orderCount = counting.length;
    const spend = counting.reduce((sum, o) => sum + (Number(o.total_aud) || 0), 0);

    if (orderCount >= VELOCITY_LIMITS.ordersPer24h) {
      return {
        allowed: false,
        reason: 'order_count',
        message: `New accounts are limited to ${VELOCITY_LIMITS.ordersPer24h} orders per day. Verify your identity to lift this limit.`,
      };
    }

    if (spend + value > VELOCITY_LIMITS.spendPer24hAud) {
      return {
        allowed: false,
        reason: 'daily_spend',
        message: `New accounts have a $${VELOCITY_LIMITS.spendPer24hAud} AUD daily spending limit. Verify your identity to lift this limit.`,
      };
    }

    return { allowed: true };
  } catch (err) {
    logger.error(`[VELOCITY] check failed (failing open): ${err.message}`);
    return { allowed: true };
  }
}
