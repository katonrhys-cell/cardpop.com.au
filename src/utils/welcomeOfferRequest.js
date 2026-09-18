const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The auth user id a POST /welcome-offer/issue call is about, or null.
 *
 * Two callers post to that endpoint in two different shapes, and both the route
 * and its rate limiter have to read the id the same way — if they disagree, the
 * limiter silently falls back to keying by IP and every signup from behind the
 * same Supabase egress address shares one bucket:
 *
 *   - the signup page sends `{ userId }`
 *   - the `profiles_welcome_offer` database webhook sends the Supabase webhook
 *     envelope, `{ type, table, record: { id, ... } }`
 *
 * @param {unknown} body — a parsed JSON request body (any shape)
 * @returns {string|null} the lower-cased uuid, or null if there isn't a valid one
 */
export function welcomeOfferUserId(body) {
  const raw = body?.userId ?? body?.record?.id;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return UUID_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

export default welcomeOfferUserId;
