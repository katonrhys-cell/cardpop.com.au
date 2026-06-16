import 'dotenv/config';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = data.user;
    req.supabase = supabase;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
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

export { authMiddleware, optionalAuthMiddleware };
