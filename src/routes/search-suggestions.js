import logger from "../utils/logger.js";
import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { findBestMatches, getDidYouMean } from '../../utils/fuzzyMatch.js';
import { PUBLIC_SHOP_STATUSES } from '../../utils/shopStock.js';
import { publicCache, CACHE_MEDIUM } from '../middleware/publicCache.js';
import { createTtlCache } from '../utils/ttlCache.js';

const router = Router();

// The "did you mean" pool: the 500 newest public card names — wide enough to
// catch common misspellings without pulling the whole table. It is the same for
// every query, so a warm instance keeps it for a few minutes instead of
// re-reading 500 rows on every mistyped search. A failed read is not cached.
const fuzzyPoolCache = createTtlCache({
  ttlMs: () => process.env.SEARCH_FUZZY_POOL_TTL_MS ?? 5 * 60 * 1000,
  maxEntries: 1,
});

async function loadFuzzyPool() {
  const names = await fuzzyPoolCache.get('pool', async () => {
    const { data, error } = await supabase
      .from('vault_items')
      .select('card_name')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error || !data) return undefined; // undefined is never cached
    return data.map((card) => card.card_name).filter(Boolean);
  });
  return names || [];
}

// Get search suggestions based on query
router.get('/', publicCache(CACHE_MEDIUM), async (req, res) => {
  try {
    const { q } = req.query;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    // ?q=a&q=b arrives as an array, which passed the length check and then
    // threw on .toLowerCase() — a 500 from a public endpoint.
    if (typeof q !== 'string' || q.length < 2) {
      return res.json({ suggestions: [], didYouMean: null });
    }

    // Sanitize the term before interpolating into PostgREST filter strings.
    // `.or()` takes a query-grammar string (not a bound parameter), so commas,
    // parentheses and dots could inject extra filter clauses. Also strip LIKE
    // wildcards (% _) which would otherwise let `q=%` match everything / force a
    // full scan. Cap length defensively.
    const safeQ = String(q).replace(/[,.()%_\\]/g, ' ').trim().slice(0, 100);
    if (safeQ.length < 2) {
      return res.json({ suggestions: [], didYouMean: null });
    }

    // Card names and shop titles are independent reads, so they run together
    // rather than one after the other (Sentry flagged the chain of sequential
    // Supabase calls on this endpoint as "Consecutive HTTP").
    //
    // Cards are scoped to PUBLIC items only. This router runs with the
    // service-role client (RLS bypassed) and needs no authentication, so an
    // unscoped query published the card names sitting in every user's private
    // vault to anonymous callers — a `q` of two common letters walks the whole
    // table two characters at a time. `is_public` mirrors the vault_items
    // SELECT policy's public branch.
    //
    // Shop titles come from `shop_products` (the real catalogue; its only text
    // title column is `title`).
    const [
      { data: cards, error: cardsError },
      { data: shopProducts, error: productsError },
    ] = await Promise.all([
      supabase
        .from('vault_items')
        .select('card_name')
        .eq('is_public', true)
        .ilike('card_name', `%${safeQ}%`)
        .limit(limit)
        .order('card_name'),
      supabase
        .from('shop_products')
        .select('title')
        .in('status', PUBLIC_SHOP_STATUSES)
        .ilike('title', `%${safeQ}%`)
        .limit(limit)
        .order('title'),
    ]);

    if (cardsError) throw cardsError;
    if (productsError) throw productsError;

    // Combine and deduplicate suggestions (case-insensitively, keeping the
    // first-seen casing — otherwise "Charizard" and "charizard" both appear).
    // (A third query used to "backfill" from the ten newest card names that
    // contain the term — every one of which the ilike query above had already
    // matched, so it cost a round-trip and added nothing.)
    const suggestions = new Map();
    const addSuggestion = (name) => {
      if (!name) return;
      const key = name.toLowerCase();
      if (!suggestions.has(key)) suggestions.set(key, name);
    };

    cards?.forEach(card => addSuggestion(card.card_name));
    shopProducts?.forEach(product => addSuggestion(product.title));

    const suggestionsArray = Array.from(suggestions.values()).slice(0, limit);

    // Add fuzzy matching for "Did you mean?" if no exact matches
    let didYouMean = null;
    if (suggestionsArray.length === 0) {
      const allCardNames = await loadFuzzyPool();
      if (allCardNames.length > 0) {
        didYouMean = getDidYouMean(q, allCardNames, 0.6);
      }
    }

    res.json({
      suggestions: suggestionsArray,
      didYouMean
    });
  } catch (error) {
    logger.error('Error generating search suggestions:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

export default router;
