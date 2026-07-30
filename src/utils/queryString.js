/**
 * Coerce an Express query-string value to a single trimmed string.
 *
 * Express parses a *repeated* query parameter (`?sort=a&sort=b`) into an ARRAY,
 * so a handler that calls a string method on `req.query.x` throws a TypeError
 * and answers 500. That includes the very common guard `if (!x?.trim())` —
 * optional chaining only guards null/undefined, so `['a','b'].trim()` still
 * throws. Any client can send a repeated parameter, so every such handler has
 * a trivially reachable 500.
 *
 * Collapses an array to its first entry, coerces nothing else, and returns ''
 * for absent or non-string values so callers can rely on a plain string.
 *
 * Only needed for `req.query`; `req.params` values are always strings.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function queryString(value) {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first.trim() : '';
}

export default queryString;
