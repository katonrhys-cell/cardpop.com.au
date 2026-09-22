import logger from "../utils/logger.js";
import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { findBestMatches, getDidYouMean } from '../../utils/fuzzyMatch.js';

const router = Router();

// Get search suggestions based on query
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    if (!q || q.length < 2) {
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

    // Search for card names in vault_items.
    //
    // Scoped to PUBLIC items only. This router runs with the service-role client
    // (RLS bypassed) and needs no authentication, so an unscoped query published
    // the card names sitting in every user's private vault to anonymous callers
    // — a `q` of two common letters walks the whole table two characters at a
    // time. `is_public` mirrors the vault_items SELECT policy's public branch.
    const { data: cards, error: cardsError } = await supabase
      .from('vault_items')
      .select('card_name')
      .eq('is_public', true)
      .ilike('card_name', `%${safeQ}%`)
      .limit(limit)
      .order('card_name');

    if (cardsError) throw cardsError;

    // Search active shop product titles. (Was querying a stale `products`
    // table with a non-existent `name` column, so shop items never surfaced in
    // suggestions; the real catalogue is `shop_products`, whose only text title
    // column is `title`.)
    const { data: shopProducts, error: productsError } = await supabase
      .from('shop_products')
      .select('title')
      .in('status', ['active', 'coming_soon'])
      .ilike('title', `%${safeQ}%`)
      .limit(limit)
      .order('title');

    if (productsError) throw productsError;

    // Combine and deduplicate suggestions (case-insensitively, keeping the
    // first-seen casing — otherwise "Charizard" and "charizard" both appear).
    const suggestions = new Map();
    const addSuggestion = (name) => {
      if (!name) return;
      const key = name.toLowerCase();
      if (!suggestions.has(key)) suggestions.set(key, name);
    };

    cards?.forEach(card => addSuggestion(card.card_name));
    shopProducts?.forEach(product => addSuggestion(product.title));

    // Backfill with recent card names if few results. (This query previously
    // ordered by a non-existent `created` column, so it errored and was
    // silently skipped on every request.)
    if (suggestions.size < 5) {
      const { data: popularCards, error: popularError } = await supabase
        .from('vault_items')
        .select('card_name')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!popularError && popularCards) {
        popularCards.forEach(card => {
          if (card.card_name && card.card_name.toLowerCase().includes(q.toLowerCase())) {
            addSuggestion(card.card_name);
          }
        });
      }
    }

    const suggestionsArray = Array.from(suggestions.values()).slice(0, limit);

    // Add fuzzy matching for "Did you mean?" if no exact matches
    let didYouMean = null;
    if (suggestionsArray.length === 0) {
      // Recent card names as the fuzzy pool — wide enough to catch common
      // misspellings without pulling the whole table.
      const { data: allCards, error: allCardsError } = await supabase
        .from('vault_items')
        .select('card_name')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(500);

      if (!allCardsError && allCards) {
        const allCardNames = allCards.map(card => card.card_name).filter(Boolean);
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
