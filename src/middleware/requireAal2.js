import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { isAdminUser } from './auth.js';
import { createTtlCache } from '../utils/ttlCache.js';

// Whether a user has a verified MFA factor, cached briefly per user. Every
// admin request with an AAL1 token used to call auth.admin.mfa.listFactors —
// a GoTrue round-trip on top of token verification — and the admin panel
// issues many per page. Enrolling or removing a factor is visible within
// MFA_FACTORS_CACHE_TTL_MS (default 30 s); a failed lookup is never cached, so
// the fail-closed 403 below still fires on every attempt while GoTrue is down.
const verifiedFactorCache = createTtlCache({ ttlMs: () => process.env.MFA_FACTORS_CACHE_TTL_MS ?? 30_000 });

async function hasVerifiedMfaFactor(userId) {
  return verifiedFactorCache.get(userId, async () => {
    const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId });
    if (error) throw error;
    return (data?.factors ?? []).some((f) => f.status === 'verified');
  });
}

// Read the `aal` (Authenticator Assurance Level) claim from a Supabase access
// token WITHOUT verifying the signature. This is safe here because the token has
// already been validated upstream by authMiddleware (supabase.auth.getUser);
// we only need to read a claim from a token we already trust. Returns the claim
// string ('aal1' | 'aal2') or null if it can't be parsed.
export function decodeAal(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = Buffer.from(
      payload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');
    return JSON.parse(json).aal ?? null;
  } catch {
    return null;
  }
}

// Enforce MFA (AAL2) server-side for users who have a verified MFA factor.
//
// Supabase's signInWithPassword returns a valid session even when TOTP is
// enrolled — that session is AAL1, and the second factor only *upgrades* it to
// AAL2. The backend validates tokens with getUser(), which happily accepts an
// AAL1 token, so the "require MFA" rule was enforced only in the React UI
// (ProtectedAdminRoute). An attacker who obtained an admin's password could
// therefore mint an AAL1 token directly against the public auth endpoint and
// call privileged APIs, bypassing MFA entirely.
//
// Policy (chosen): reject an AAL1 token ONLY when the user actually has a
// verified MFA factor — i.e. they enrolled MFA but skipped the login step-up.
// Users who never enrolled MFA are unaffected, so this can never lock anyone
// out; it simply makes the step-up they already opted into mandatory on the
// server, not just in the browser.
//
// Must run AFTER authMiddleware (it relies on req.user) and is intended for
// privileged surfaces such as the admin router. Fails CLOSED: if MFA status
// can't be determined for a privileged request, access is denied.
export async function requireAal2(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || !req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Already stepped up — nothing to check.
    if (decodeAal(token) === 'aal2') return next();

    // AAL1 (or unknown): allowed only if the user has NO verified factor.
    let hasVerifiedFactor;
    try {
      hasVerifiedFactor = await hasVerifiedMfaFactor(req.user.id);
    } catch (error) {
      logger.error('requireAal2: listFactors failed:', error);
      return res.status(403).json({ error: 'Could not verify MFA status', code: 'mfa_check_failed' });
    }

    if (hasVerifiedFactor) {
      return res.status(403).json({
        error: 'Multi-factor authentication required. Complete the MFA challenge and try again.',
        code: 'mfa_required',
      });
    }

    return next();
  } catch (err) {
    logger.error('requireAal2 middleware error:', err);
    return res.status(403).json({ error: 'Could not verify MFA status', code: 'mfa_check_failed' });
  }
}

// Composite gate for privileged admin actions that live OUTSIDE the /admin
// router (partner payouts, buyer-protection resolutions, catalogue edits, vault
// base-value, seller-performance overrides, the event scraper, …). Each of
// these previously did an inline isAdminUser() check but never enforced MFA, so
// an attacker with only an admin's password could mint an AAL1 token and call
// them — the exact bypass requireAal2 closes for /admin. This bundles the three
// checks in the right order:
//   1. authenticated  (req.user present — set by authMiddleware/optionalAuth)
//   2. admin          (isAdminUser)
//   3. stepped-up MFA (requireAal2 — only bites admins who enrolled MFA)
// Non-admins get a 403 before any MFA probing. Must run after an auth middleware
// that may populate req.user. Fails closed.
export async function requireAdmin(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!(await isAdminUser(req))) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return requireAal2(req, res, next);
}

export default requireAal2;
