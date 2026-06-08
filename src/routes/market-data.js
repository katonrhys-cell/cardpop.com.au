import { Router } from 'express';
import { supabaseAuth } from '../middleware/pocketbase-auth.js';
import { refreshCardMarketData, getStoredMarketData } from '../utils/marketDataService.js';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

const router = Router();

// ─── GET /market-data/card/:cardId ────────────────────────────────────────────
// Returns stored valuations + sold history for a CardSight card ID.
// If data is stale (> 24 h) or missing, triggers a background refresh.
router.get('/card/:cardId', async (req, res) => {
  const { cardId } = req.params;
  if (!cardId?.trim()) return res.status(400).json({ error: 'cardId is required' });

  try {
    const stored = await getStoredMarketData(cardId);
    const hasData = Object.keys(stored.valuations).length > 0;

    // Determine if any valuation is stale (older than 24 h)
    const staleThreshold = Date.now() - 24 * 60 * 60 * 1000;
    const isStale = !hasData || Object.values(stored.valuations).some(
      v => !v.last_updated || new Date(v.last_updated).getTime() < staleThreshold
    );

    if (isStale) {
      // Pull card meta from vault_items if available for a richer query
      const { data: vi } = await supabase
        .from('vault_items')
        .select('card_name, set_name')
        .eq('cardsight_card_id', cardId)
        .limit(1)
        .maybeSingle();

      // Background refresh — don't block the response
      refreshCardMarketData({
        cardId,
        cardName: vi?.card_name ?? null,
        setName:  vi?.set_name  ?? null,
      }).catch(err => logger.error(`[MARKET_DATA_ROUTE] Background refresh failed: ${err.message}`));
    }

    res.json({ cardId, ...stored, refreshing: isStale });
  } catch (err) {
    logger.error(`[MARKET_DATA_ROUTE] GET /card/${cardId}: ${err.message}`);
    res.status(500).json({ error: 'Failed to retrieve market data.' });
  }
});

// ─── POST /market-data/refresh (auth required) ────────────────────────────────
// Manually trigger a full refresh for a card. Accepts { cardId, cardName, setName }.
router.post('/refresh', supabaseAuth, async (req, res) => {
  const { cardId, cardName, setName } = req.body ?? {};
  if (!cardId?.trim()) return res.status(400).json({ error: 'cardId is required' });

  logger.info(`[MARKET_DATA_ROUTE] Manual refresh: ${cardId} by user ${req.user?.id}`);

  try {
    const result = await refreshCardMarketData({ cardId, cardName, setName });
    const stored = await getStoredMarketData(cardId);
    res.json({ cardId, ...stored, refreshResult: result });
  } catch (err) {
    logger.error(`[MARKET_DATA_ROUTE] POST /refresh: ${err.message}`);
    res.status(500).json({ error: 'Refresh failed.' });
  }
});

// ─── GET /market-data/sold/:cardId ────────────────────────────────────────────
// Returns recent sold listing records for charting.
router.get('/sold/:cardId', async (req, res) => {
  const { cardId } = req.params;
  const limit = Math.min(200, parseInt(req.query.limit ?? '50', 10));

  try {
    const { data, error } = await supabase
      .from('market_sold_listings')
      .select('*')
      .eq('card_id', cardId)
      .order('sold_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    logger.error(`[MARKET_DATA_ROUTE] GET /sold/${cardId}: ${err.message}`);
    res.status(500).json({ error: 'Failed to retrieve sold listings.' });
  }
});

export default router;
