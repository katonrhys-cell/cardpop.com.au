import 'dotenv/config';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { getUserForToken } from '../utils/authTokenCache.js';
import { createTtlCache } from '../utils/ttlCache.js';

// RFC 9728 §5.1: point unauthenticated callers at the protected-resource
// metadata so agents can discover how to obtain a token.
const RESOURCE_METADATA_URL =
  'https://cardpop.com.au/.well-known/oauth-protected-resource';
const WWW_AUTHENTICATE = `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`;

// Token verification goes through getUserForToken (src/utils/authTokenCache.js):
// the same supabase.auth.getUser() call, cached per token for a short window
// so the SPA's burst of API calls per page doesn't re-verify the same bearer
// on every request — and a route that checks twice pays once.
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .set('WWW-Authenticate', WWW_AUTHENTICATE)
      .json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    const { data, error } = await getUserForToken(token);

    if (error || !data?.user) {
      return res
        .status(401)
        .set('WWW-Authenticate', WWW_AUTHENTICATE)
        .json({ error: 'Invalid or expired token' });
    }

    req.user = data.user;
    req.supabase = supabase;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res
      .status(401)
      .set('WWW-Authenticate', WWW_AUTHENTICATE)
      .json({ error: 'Invalid or expired token' });
  }
}

// Like authMiddleware but never returns 401 — populates req.user if a valid
// Bearer token is present, otherwise continues with req.user undefined.
// Use on routes that serve both public and authenticated content.
async function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { data } = await getUserForToken(authHeader.substring(7));
      if (data?.user) req.user = data.user;
    } catch {
      // Ignore — treat as unauthenticated
    }
  }
  next();
}

// profiles.is_admin per user, cached briefly: requireAdmin runs isAdminUser and
// then most admin routers re-check it inline, and the admin panel fires many
// requests per page. A demotion reaches the API within ADMIN_FLAG_CACHE_TTL_MS
// (default 30 s). Only `true`/`false` verdicts are cached — a failed read is
// not, so a transient outage can't be remembered as "not an admin".
const adminFlagCache = createTtlCache({ ttlMs: () => process.env.ADMIN_FLAG_CACHE_TTL_MS ?? 30_000 });

// Returns true if the authenticated request belongs to an admin. Accepts the
// server-controlled JWT app_metadata.is_admin claim, and falls back to a
// server-side profiles.is_admin lookup (defence-in-depth). Admin is granted via
// profiles.is_admin and is not currently mirrored into app_metadata, so the JWT
// claim alone would reject real admins. Returns false for unauthenticated reqs.
// The verdict is memoised on the request, so a router's inline re-check after
// requireAdmin costs nothing.
async function isAdminUser(req) {
  if (req.user?.app_metadata?.is_admin === true) return true;
  if (!req.user?.id) return false;
  if (req._isAdminUser !== undefined) return req._isAdminUser;
  const verdict = await adminFlagCache.get(req.user.id, async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', req.user.id)
        .maybeSingle();
      if (error) return undefined; // don't cache a failed read
      return data?.is_admin === true;
    } catch {
      return undefined;
    }
  });
  req._isAdminUser = verdict === true;
  return req._isAdminUser;
}

export { authMiddleware, optionalAuthMiddleware, isAdminUser };
