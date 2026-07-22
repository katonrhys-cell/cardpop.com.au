// Pure helpers behind the whole-site search results page (pages/SearchResultsPage.jsx).
// Kept framework-free so the relevance logic can be unit-tested directly.

// Strip characters that break the PostgREST .or()/.ilike filter grammar: %
// (ilike wildcard), , (clause separator) and () (grouping), and collapse
// whitespace. Mirrors the sanitisation used by the marketplace/suggestions queries.
export const sanitizeSearch = (q) =>
  String(q || '').trim().replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').trim();

// Split a query into search tokens. Every token must match for a row to qualify,
// so "charizard base set" finds a Charizard in Base Set even though no single
// field holds that whole phrase. Tokens shorter than 2 chars and duplicates are
// dropped; capped so a pathological query can't build a giant filter.
export const tokenizeSearch = (q) =>
  Array.from(new Set(sanitizeSearch(q).toLowerCase().split(' ').filter((t) => t.length >= 2))).slice(0, 6);

// Relevance score for one row against the query. Higher = better match. Rewards
// exact title matches, then prefix, then whole-phrase, then per-token coverage,
// and gently prefers shorter (more specific) titles as a tiebreaker.
export function relevanceScore(title, haystack, qLower, tokens) {
  const t = (title || '').toLowerCase();
  const h = (haystack || '').toLowerCase();
  let score = 0;
  if (t === qLower) score += 1000;
  else if (t.startsWith(qLower)) score += 500;
  else if (t.includes(qLower)) score += 250;
  if (h.includes(qLower)) score += 100;
  let matched = 0;
  for (const tok of tokens) {
    if (t.includes(tok)) { score += 30; matched += 1; }
    else if (h.includes(tok)) { score += 15; matched += 1; }
  }
  if (tokens.length && matched === tokens.length) score += 50;
  score -= Math.min(t.length, 40) * 0.1;
  return score;
}

// Rank items (each carrying _title/_haystack) by relevance, best first, keeping
// at most `limit`.
export function rankItems(items, qLower, tokens, limit) {
  return items
    .map((it) => ({ it, s: relevanceScore(it._title, it._haystack, qLower, tokens) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.it);
}
