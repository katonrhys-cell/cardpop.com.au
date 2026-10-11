import crypto from 'node:crypto';

// Signed token that lets an abandoned-checkout email restore the shopper's cart
// on any device without an account: HMAC of the order id under a server
// secret. Knowing an order id alone is not enough; the token never carries
// personal data, and the endpoint it unlocks returns only the lines (ids,
// titles, prices, quantities) — never the address or the buyer's email.

const secret = () => process.env.CART_RESTORE_SECRET || process.env.ENCRYPTION_KEY || process.env.CRON_SECRET || '';

export function restoreTokenConfigured() {
  return secret().length >= 16;
}

export function signRestoreToken(orderId) {
  if (!restoreTokenConfigured()) return null;
  return crypto.createHmac('sha256', secret()).update(`cart-restore:${orderId}`).digest('base64url');
}

export function verifyRestoreToken(orderId, token) {
  if (!restoreTokenConfigured() || typeof token !== 'string' || !token) return false;
  const expected = signRestoreToken(orderId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
