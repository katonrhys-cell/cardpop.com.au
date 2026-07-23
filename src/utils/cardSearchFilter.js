import { escapeLike } from './escapeLike.js';

// Columns the marketplace free-text search matches on the vault_items embed.
// Sellers capture set name and card number at listing time (the AI identify
// prefills them) — matching them means a search like "Base Set" or "4/102"
// finds the card even when the title alone wouldn't.
export const CARD_SEARCH_COLUMNS = ['card_name', 'set_name', 'card_number'];

/**
 * Build the PostgREST `or=` filter string that matches a search term against
 * every card search column. For use with the query builder's
 * `.or(filters, { referencedTable })`.
 *
 * The pattern is wrapped in double quotes so PostgREST treats the whole value
 * as one literal — otherwise a comma or parenthesis typed into the search box
 * would be parsed as `or` syntax and error the request. Inside the quoted
 * literal PostgREST unescapes `\"` and `\\`, so those are escaped after the
 * LIKE-wildcard escaping.
 *
 * @param {unknown} rawTerm the user's search input
 * @returns {string} e.g. `card_name.ilike."%pikachu%",set_name.ilike."%pikachu%",…`
 */
export const buildCardSearchOr = (rawTerm) => {
  const pattern = `%${escapeLike(String(rawTerm ?? '').trim())}%`;
  const quoted = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return CARD_SEARCH_COLUMNS.map((col) => `${col}.ilike.${quoted}`).join(',');
};

export default buildCardSearchOr;
