/**
 * Make a user-supplied search term safe to interpolate into a PostgREST
 * `.or()` filter string.
 *
 * `.or()` takes a fragment of PostgREST's own filter grammar, not a bound
 * parameter, so a raw term can both break the query and inject extra
 * conditions:
 *   • `,`      separates the OR'd conditions
 *   • `(` `)`  group nested `and(...)` / `or(...)` clauses
 *   • `"`      quotes a value
 *   • `*`      PostgREST's own alias for the `%` wildcard in like/ilike
 *   • `%` `_`  SQL LIKE wildcards, and `\` their escape character
 * A term containing any of these turns `display_name.ilike.%term%` into a
 * different query — at best a 400 that surfaces as "failed to load", at worst
 * an attacker-chosen row filter.
 *
 * Punctuation that is harmless *inside* a value is deliberately kept so real
 * names still match: PostgREST only splits `field.operator.value` on the first
 * two dots, so periods, apostrophes and hyphens are safe and "O'Brien" or
 * "J. Smith" keep working.
 *
 * Use for `.or()` filter strings. For a single `.ilike()` column — where the
 * value IS passed as a parameter and only the LIKE wildcards matter — prefer
 * `escapeLike`, which escapes rather than strips.
 *
 * @param {unknown} term
 * @param {number} max Maximum length of the returned term.
 * @returns {string}
 */
export function orFilterTerm(term, max = 80) {
  return String(term ?? '')
    .replace(/[,()%_\\"*:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export default orFilterTerm;
