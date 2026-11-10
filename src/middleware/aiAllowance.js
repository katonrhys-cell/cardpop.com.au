import { checkAiAllowance } from '../utils/aiUsage.js';
import { isAdminUser } from './auth.js';

/**
 * Refuse a member-facing AI request once the member has used this month's
 * allowance for `feature` (src/utils/aiUsage.js → AI_ALLOWANCES). Mount it
 * after the route's auth check and before any upload parsing, so a refused
 * request costs nothing. Admins are exempt. Fails open when the ledger can't
 * be read.
 */
export function requireAiAllowance(feature) {
  return async (req, res, next) => {
    const userId = req.userId || req.user?.id;
    if (!userId) return next();
    try {
      if (await isAdminUser({ user: { id: userId } })) return next();
    } catch { /* not an admin as far as we can tell */ }
    const { allowed, used, limit } = await checkAiAllowance(userId, feature);
    if (allowed) return next();
    return res.status(429).json({
      error: `You've used all ${limit} of this month's ${label(feature)}. Your allowance resets on the 1st.`,
      code: 'ai_allowance_exhausted',
      feature,
      used,
      limit,
    });
  };
}

const LABELS = {
  card_scan: 'card scans',
  grade_estimate: 'grade estimates',
  card_description: 'AI descriptions',
};
const label = (feature) => LABELS[feature] || 'AI requests';
