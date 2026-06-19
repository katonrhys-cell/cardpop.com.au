import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { optionalAuthMiddleware, isAdminUser } from '../middleware/auth.js';

const router = Router();

// Reads are public; writes are gated to admins (see POST handler).
router.use(optionalAuthMiddleware);

// Get price history for an item
router.get('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { itemType = 'vault_item', days = 90 } = req.query;

    const daysNum = parseInt(days) || 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const { data: priceHistory, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .gte('recorded_at', startDate.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) throw error;

    // Calculate statistics
    const prices = priceHistory?.map(p => p.price) || [];
    const stats = {
      current: prices.length > 0 ? prices[prices.length - 1] : null,
      highest: prices.length > 0 ? Math.max(...prices) : null,
      lowest: prices.length > 0 ? Math.min(...prices) : null,
      average: prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : null,
      change: null,
      changePercent: null
    };

    if (prices.length >= 2) {
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];
      stats.change = (lastPrice - firstPrice).toFixed(2);
      stats.changePercent = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
    }

    res.json({
      history: priceHistory || [],
      stats,
      period: `${daysNum} days`
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

// Record a price point (for automated tracking) — admin only to prevent
// anyone from injecting arbitrary prices that feed valuations.
router.post('/', async (req, res) => {
  try {
    if (!(await isAdminUser(req))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { item_id, item_type, price, currency = 'AUD', source = 'listing' } = req.body;

    if (!item_id || !item_type || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: pricePoint, error } = await supabase
      .from('price_history')
      .insert({
        item_id,
        item_type,
        price: parseFloat(price),
        currency,
        source
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(pricePoint);
  } catch (error) {
    console.error('Error recording price:', error);
    res.status(500).json({ error: 'Failed to record price' });
  }
});

// Get market price comparison
router.get('/market/:cardName', async (req, res) => {
  try {
    const { cardName } = req.params;

    // Get market data for this card
    const { data: marketData, error: marketError } = await supabase
      .from('market_data')
      .select('*')
      .ilike('card_name', `%${cardName}%`)
      .order('recorded_at', { ascending: false })
      .limit(10);

    if (marketError) throw marketError;

    // Get current listing prices
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('price_aud')
      .eq('status', 'active')
      .limit(50);

    if (listingsError) throw listingsError;

    const listingPrices = listings?.map(l => l.price_aud) || [];
    const marketStats = {
      averageListingPrice: listingPrices.length > 0 
        ? (listingPrices.reduce((a, b) => a + b, 0) / listingPrices.length).toFixed(2) 
        : null,
      lowestListingPrice: listingPrices.length > 0 ? Math.min(...listingPrices) : null,
      highestListingPrice: listingPrices.length > 0 ? Math.max(...listingPrices) : null,
      marketData: marketData || []
    };

    res.json(marketStats);
  } catch (error) {
    console.error('Error fetching market comparison:', error);
    res.status(500).json({ error: 'Failed to fetch market comparison' });
  }
});

export default router;
