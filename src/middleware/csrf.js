import crypto from 'crypto';
import logger from '../utils/logger.js';

const csrfTokens = new Map();
const TOKEN_EXPIRY = 3600000;

// Routes that should be exempt from CSRF validation
const CSRF_EXEMPT_ROUTES = [
  '/event-scraper',
  '/health',
  '/.well-known/security.txt',
  '/auth/login/authenticate',
  '/auth/password/reset/request',
  '/auth/password/reset/verify',
  '/auth/password/reset/complete',
  '/stripe/webhook',
];

function generateCSRFToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_EXPIRY;
  csrfTokens.set(token, expiresAt);
  return token;
}

function validateCSRFToken(token) {
  if (!token) {
    return false;
  }

  const expiresAt = csrfTokens.get(token);

  if (!expiresAt || Date.now() > expiresAt) {
    csrfTokens.delete(token);
    return false;
  }

  csrfTokens.delete(token);
  return true;
}

/**
 * Check if a route is exempt from CSRF validation
 * @param {string} path - Request path
 * @returns {boolean} True if route is exempt
 */
function isCSRFExempt(path) {
  if (!path) return false;
  
  // Check if path matches any exempt route
  return CSRF_EXEMPT_ROUTES.some(exemptRoute => {
    // Exact match
    if (path === exemptRoute) return true;
    // Prefix match (e.g., /event-scraper matches /event-scraper/...)
    if (path.startsWith(exemptRoute + '/')) return true;
    return false;
  });
}

function csrfMiddleware(req, res, next) {
  // Skip CSRF validation for exempt routes
  if (isCSRFExempt(req.path)) {
    logger.debug(`[CSRF] Skipping CSRF validation for exempt route: ${req.method} ${req.path}`);
    return next();
  }

  // Only validate CSRF tokens for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] || req.body?.csrfToken;

    if (!validateCSRFToken(token)) {
      logger.warn(`[CSRF] CSRF validation failed for ${req.method} ${req.path}`);
      return res.status(403).json({ error: 'CSRF token invalid or expired' });
    }

    logger.debug(`[CSRF] CSRF token validated for ${req.method} ${req.path}`);
  }

  next();
}

export { generateCSRFToken, validateCSRFToken, csrfMiddleware };