import 'dotenv/config';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

// RFC 9728 §5.1: point unauthenticated callers at the protected-resource
// metadata so agents can discover how to obtain a token.
const RESOURCE_METADATA_URL =
  'https://cardpop.com.au/.well-known/oauth-protected-resource';
const WWW_AUTHENTICATE = `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`;

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
    const { data, error } = await supabase.auth.getUser(token);

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
      const { data } = await supabase.auth.getUser(authHeader.substring(7));
      if (data?.user) req.user = data.user;
    } catch {
      // Ignore — treat as unauthenticated
    }
  }
  next();
}

// Returns true if the authenticated request belongs to an admin. Accepts the
// server-controlled JWT app_metadata.is_admin claim, and falls back to a
// server-side profiles.is_admin lookup (defence-in-depth). Admin is granted via
// profiles.is_admin and is not currently mirrored into app_metadata, so the JWT
// claim alone would reject real admins. Returns false for unauthenticated reqs.
async function isAdminUser(req) {
  if (req.user?.app_metadata?.is_admin === true) return true;
  if (!req.user?.id) return false;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', req.user.id)
      .maybeSingle();
    return data?.is_admin === true;
  } catch {
    return false;
  }
}

export { authMiddleware, optionalAuthMiddleware, isAdminUser };
