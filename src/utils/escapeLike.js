/**
 * Escape a user-supplied term for safe use inside a PostgREST/PostgreSQL
 * ILIKE pattern. The `%` and `_` characters are LIKE wildcards and `\` is the
 * default escape character, so a raw term lets a caller inject wildcards
 * (e.g. `%` matches everything and forces a full-table scan). Escaping them with
 * a backslash makes ILIKE treat them as literal characters.
 *
 * Wrap the result in your own surrounding wildcards, e.g.
 *   .ilike('card_name', `%${escapeLike(term)}%`)
 *
 * @param {unknown} term
 * @returns {string}
 */
export function escapeLike(term) {
  return String(term ?? '').replace(/[\\%_]/g, (m) => `\\${m}`);
}

export default escapeLike;
