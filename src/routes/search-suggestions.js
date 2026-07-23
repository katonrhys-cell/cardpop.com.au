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

    // Search for card names in vault_items
    const { data: cards, error: cardsError } = await supabase
      .from('vault_items')
      .select('card_name')
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
      .eq('status', 'active')
      .ilike('title', `%${safeQ}%`)
      .limit(limit)
      .order('title');

    if (productsError) throw productsError;

    // Combine and deduplicate suggestions
    const suggestions = new Set();

    cards?.forEach(card => {
      if (card.card_name) suggestions.add(card.card_name);
    });

    shopProducts?.forEach(product => {
      if (product.title) suggestions.add(product.title);
    });

    // Add popular card names as fallback if few results
    if (suggestions.size < 5) {
      const { data: popularCards, error: popularError } = await supabase
        .from('vault_items')
        .select('card_name')
        .order('created', { ascending: false })
        .limit(10);

      if (!popularError && popularCards) {
        popularCards.forEach(card => {
          if (card.card_name && card.card_name.toLowerCase().includes(q.toLowerCase())) {
            suggestions.add(card.card_name);
          }
        });
      }
    }

    const suggestionsArray = Array.from(suggestions).slice(0, limit);
    
    // Add fuzzy matching for "Did you mean?" if no exact matches
    let didYouMean = null;
    if (suggestionsArray.length === 0) {
      // Get all card names for fuzzy matching
      const { data: allCards, error: allCardsError } = await supabase
        .from('vault_items')
        .select('card_name')
        .limit(100);

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
