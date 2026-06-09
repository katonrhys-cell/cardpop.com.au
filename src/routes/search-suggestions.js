import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { findBestMatches, getDidYouMean } from '../../utils/fuzzyMatch.js';

const router = Router();

// Get search suggestions based on query
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    const limit = parseInt(req.query.limit) || 10;
    
    if (!q || q.length < 2) {
      return res.json({ suggestions: [], didYouMean: null });
    }

    // Search for card names in vault_items
    const { data: cards, error: cardsError } = await supabase
      .from('vault_items')
      .select('card_name')
      .ilike('card_name', `%${q}%`)
      .limit(limit)
      .order('card_name');

    if (cardsError) throw cardsError;

    // Search for product names
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('title, name')
      .or(`title.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(limit)
      .order('title');

    if (productsError) throw productsError;

    // Combine and deduplicate suggestions
    const suggestions = new Set();
    
    cards?.forEach(card => {
      if (card.card_name) suggestions.add(card.card_name);
    });
    
    products?.forEach(product => {
      if (product.title) suggestions.add(product.title);
      if (product.name) suggestions.add(product.name);
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
    console.error('Error generating search suggestions:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

export default router;
