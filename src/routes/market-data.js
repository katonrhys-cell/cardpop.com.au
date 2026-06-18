import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { getUsdToAudRate } from '../utils/exchangeRates.js';

const router = Router();

// Reads are public; writes are gated to admins (see POST handler).
router.use(optionalAuthMiddleware);

// Get market data for a card
router.get('/:cardName', async (req, res) => {
  try {
    const { cardName } = req.params;
    const { source } = req.query;

    let query = supabase
      .from('market_data')
      .select('*')
      .ilike('card_name', `%${cardName}%`)
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
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// Record market data (for automated imports) — admin only to prevent
// anyone from injecting arbitrary prices that feed valuations.
router.post('/', async (req, res) => {
  try {
    if (req.user?.app_metadata?.is_admin !== true) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { card_name, set_name, source, market_price, low_price, mid_price, high_price, currency = 'USD' } = req.body;

    if (!card_name || !source || !market_price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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
    console.error('Error recording market data:', error);
    res.status(500).json({ error: 'Failed to record market data' });
  }
});

// Get market price comparison across sources
router.get('/compare/:cardName', async (req, res) => {
  try {
    const { cardName } = req.params;

    // Get latest market data from all sources
    const { data: allData, error } = await supabase
      .from('market_data')
      .select('*')
      .ilike('card_name', `%${cardName}%`)
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
    console.error('Error comparing market prices:', error);
    res.status(500).json({ error: 'Failed to compare market prices' });
  }
});

// Get trending cards (by market data volume)
router.get('/trending/limit/:limit', async (req, res) => {
  try {
    const { limit } = req.params;
    const limitNum = parseInt(limit) || 10;

    // Get cards with most recent market data updates
    const { data: trending, error } = await supabase
      .from('market_data')
      .select('card_name, set_name, market_price, source, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(limitNum * 5); // Get more to account for duplicates

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
      .slice(0, limitNum);

    res.json(sortedCards);
  } catch (error) {
    console.error('Error fetching trending cards:', error);
    res.status(500).json({ error: 'Failed to fetch trending cards' });
  }
});

export default router;
