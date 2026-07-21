import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { optionalAuthMiddleware, isAdminUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { validateRequestBody, validateRequestParams, validateRequestQuery } from '../middleware/validateRequest.js';
import { getMarketDataSchema, recordMarketDataSchema, compareMarketPricesSchema, getTrendingSchema } from '../schemas/marketDataSchemas.js';
import { getUsdToAudRate } from '../utils/exchangeRates.js';
import { escapeLike } from '../utils/escapeLike.js';
import logger from '../utils/logger.js';

const router = Router();

// Reads are public; writes are gated to admins (see POST handler).
router.use(optionalAuthMiddleware);

// Get market data for a card
router.get('/:cardName', validateRequestParams(getMarketDataSchema), async (req, res) => {
  try {
    const { cardName } = req.params;
    const { source } = req.query;

    let query = supabase
      .from('market_data')
      .select('*')
      .ilike('card_name', `%${escapeLike(cardName)}%`)
      .order('recorded_at', { ascending: false })
      .limit(20);

    if (source) {
      query = query.eq('source', source);
    }

    const { data: marketData, error } = await query;

    if (error) throw error;

    // Aggregate data by source
    const aggregated = {};
    marketData?.forEach(item => {
      if (!aggregated[item.source]) {
        aggregated[item.source] = {
          source: item.source,
          prices: [],
          latest: null
        };
      }
      aggregated[item.source].prices.push({
        market_price: item.market_price,
        low_price: item.low_price,
        mid_price: item.mid_price,
        high_price: item.high_price,
        recorded_at: item.recorded_at
      });
      
      // Keep the latest entry
      if (!aggregated[item.source].latest || new Date(item.recorded_at) > new Date(aggregated[item.source].latest.recorded_at)) {
        aggregated[item.source].latest = item;
      }
    });

    res.json({
      data: Object.values(aggregated),
      sources: Object.keys(aggregated)
    });
  } catch (error) {
    logger.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// Record market data (for automated imports) — admin only to prevent
// anyone from injecting arbitrary prices that feed valuations.
router.post('/', requireAdmin, validateRequestBody(recordMarketDataSchema), async (req, res) => {
  try {
    if (!(await isAdminUser(req))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { card_name, set_name, source, market_price, low_price, mid_price, high_price, currency } = req.body;

    const { data: marketData, error } = await supabase
      .from('market_data')
      .insert({
        card_name,
        set_name: set_name || null,
        source,
        market_price: parseFloat(market_price),
        low_price: low_price ? parseFloat(low_price) : null,
        mid_price: mid_price ? parseFloat(mid_price) : null,
        high_price: high_price ? parseFloat(high_price) : null,
        currency
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(marketData);
  } catch (error) {
    logger.error('Error recording market data:', error);
    res.status(500).json({ error: 'Failed to record market data' });
  }
});

// Get market price comparison across sources
router.get('/compare/:cardName', validateRequestParams(compareMarketPricesSchema), async (req, res) => {
  try {
    const { cardName } = req.params;

    // Get latest market data from all sources
    const { data: allData, error } = await supabase
      .from('market_data')
      .select('*')
      .ilike('card_name', `%${escapeLike(cardName)}%`)
      .order('recorded_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Group by source and get latest from each
    const latestBySource = {};
    allData?.forEach(item => {
      if (!latestBySource[item.source] || new Date(item.recorded_at) > new Date(latestBySource[item.source].recorded_at)) {
        latestBySource[item.source] = item;
      }
    });

    // Calculate average market price
    const sources = Object.values(latestBySource);
    const avgPrice = sources.length > 0 
      ? (sources.reduce((sum, item) => sum + (item.market_price || 0), 0) / sources.length).toFixed(2)
      : null;

    // Convert to AUD using the live (cached) USD→AUD rate, not a hardcoded value.
    const audRate = await getUsdToAudRate();
    const avgPriceAud = avgPrice ? (avgPrice * audRate).toFixed(2) : null;

    res.json({
      comparison: sources,
      averagePrice: avgPrice,
      averagePriceAud: avgPriceAud,
      sources: Object.keys(latestBySource)
    });
  } catch (error) {
    logger.error('Error comparing market prices:', error);
    res.status(500).json({ error: 'Failed to compare market prices' });
  }
});

// Get trending cards (by market data volume)
router.get('/trending/limit/:limit', validateRequestParams(getTrendingSchema), async (req, res) => {
  try {
    const { limit: limitNum } = req.params;
    // Clamp to a sane range — validation ensures positive integer, limit to 50 max
    const clampedLimit = Math.min(50, limitNum);

    // Get cards with most recent market data updates
    const { data: trending, error } = await supabase
      .from('market_data')
      .select('card_name, set_name, market_price, source, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(clampedLimit * 5); // Get more to account for duplicates

    if (error) throw error;

    // Group by card name and count occurrences
    const cardCounts = {};
    trending?.forEach(item => {
      const key = `${item.card_name}-${item.set_name || ''}`;
      if (!cardCounts[key]) {
        cardCounts[key] = {
          card_name: item.card_name,
          set_name: item.set_name,
          count: 0,
          avg_price: 0,
          latest_price: item.market_price,
          sources: new Set()
        };
      }
      cardCounts[key].count++;
      cardCounts[key].avg_price += item.market_price;
      cardCounts[key].sources.add(item.source);
    });

    // Calculate averages and sort by count
    const sortedCards = Object.values(cardCounts)
      .map(card => ({
        ...card,
        avg_price: (card.avg_price / card.count).toFixed(2),
        sources: Array.from(card.sources)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, clampedLimit);

    res.json(sortedCards);
  } catch (error) {
    logger.error('Error fetching trending cards:', error);
    res.status(500).json({ error: 'Failed to fetch trending cards' });
  }
});

export default router;
