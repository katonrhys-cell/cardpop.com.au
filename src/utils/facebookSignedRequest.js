import crypto from 'crypto';
import logger from './logger.js';

/**
 * Decode a base64url-encoded string to a Buffer.
 * Facebook signed requests use URL-safe base64 without padding.
 */
function base64UrlDecode(input) {
  const normalised = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalised, 'base64');
}

/**
 * Parse and verify a Facebook `signed_request` (the payload Meta POSTs to a
 * Data Deletion Request callback and other server-to-server hooks).
 *
 * The signed request is `<base64url signature>.<base64url payload>`. The
 * signature is HMAC-SHA256 of the raw (still-encoded) payload string, keyed on
 * the app secret. We reject anything that doesn't verify.
 *
 * @param {string} signedRequest  The raw signed_request value.
 * @param {string} appSecret      The Facebook app secret.
 * @returns {object|null}         The decoded payload (e.g. { user_id, algorithm,
 *                                issued_at }) or null if invalid.
 */
export function parseSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || typeof signedRequest !== 'string') {
    logger.error('[facebook] Missing or non-string signed_request');
    return null;
  }
  if (!appSecret) {
    logger.error('[facebook] FACEBOOK_APP_SECRET is not set — cannot verify signed_request');
    return null;
  }

  const parts = signedRequest.split('.');
  if (parts.length !== 2) {
    logger.error('[facebook] Malformed signed_request (expected "sig.payload")');
    return null;
  }

  const [encodedSig, payload] = parts;

  let sig;
  let data;
  try {
    sig = base64UrlDecode(encodedSig);
    data = JSON.parse(base64UrlDecode(payload).toString('utf8'));
  } catch (err) {
    logger.error('[facebook] Failed to decode signed_request', err);
    return null;
  }

  if (data.algorithm && String(data.algorithm).toUpperCase() !== 'HMAC-SHA256') {
    logger.error(`[facebook] Unexpected signed_request algorithm: ${data.algorithm}`);
    return null;
  }

  // The signature covers the encoded payload string exactly as received.
  const expectedSig = crypto.createHmac('sha256', appSecret).update(payload).digest();

  // Timing-safe compare; timingSafeEqual throws if lengths differ.
  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) {
    logger.error('[facebook] Bad signed_request signature');
    return null;
  }

  return data;
}

export default parseSignedRequest;
