import { Router } from 'express';
import {
  getHighestConfidenceDetection,
  isExactMatch,
  isSetLevelMatch,
  hasGrading,
  getGradingInfo,
  hasParallel,
  getParallelInfo,
  getFieldValue,
} from 'cardsightai';
import { getCardSightClient } from '../utils/cardSightClient.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { supabaseAuth } from '../middleware/pocketbase-auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import supabase from '../utils/supabaseClient.js';
import { refreshCardMarketData } from '../utils/marketDataService.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(supabaseAuth);

// ─── POST /cardsight/identify ─────────────────────────────────────────────────
// Accepts a card image, returns identification + catalog + pricing in one shot.
// Requires authentication — protects CardSight API quota and vault item writes.
router.post(
  '/identify',
  authMiddleware,
  integratedAiRateLimit,
  uploadFiles({ allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'], fieldName: 'image' }),
  async (req, res) => {
    if (!req.files?.length) {
      return res.status(400).json({ error: 'An image file is required.' });
    }

    const client = getCardSightClient();
    const imageBuffer = req.files[0].buffer;

    // 1. Identify the card
    const identifyResult = await client.identify.card(imageBuffer);

    if (!identifyResult?.detections?.length) {
      return res.json({ identified: false, message: 'No card detected in the image.' });
    }

    const best = getHighestConfidenceDetection(identifyResult);
    if (!best) {
      return res.json({ identified: false, message: 'Could not identify card with sufficient confidence.' });
    }

    const response = {
      identified: true,
      confidence: best.confidence,
      exactMatch: isExactMatch(best),
      setLevelMatch: isSetLevelMatch(best),
      card: {
        id: best.card?.id ?? null,
        name: best.card?.name ?? null,
        year: best.card?.year ?? null,
        setName: best.card?.setName ?? null,
        setId: best.card?.setId ?? null,
        cardNumber: best.card?.cardNumber ?? null,
        manufacturer: best.card?.manufacturer ?? null,
        segment: best.card?.segment ?? null,
        sport: best.card?.sport ?? null,
        rarity: getFieldValue(best, 'Rarity') ?? null,
        hp: getFieldValue(best, 'HP') ?? null,
        artist: getFieldValue(best, 'Artist') ?? null,
      },
      grading: hasGrading(best) ? getGradingInfo(best) : null,
      parallel: hasParallel(best) ? getParallelInfo(best) : null,
    };

    // 2. If we have an exact card match, fetch catalog detail + pricing
    if (isExactMatch(best) && best.card?.id) {
      const cardId = best.card.id;
      const [catalogResult, pricingResult] = await Promise.allSettled([
        client.catalog.cards.get(cardId),
        client.pricing.get(cardId),
      ]);

      if (catalogResult.status === 'fulfilled') {
        const c = catalogResult.value;
        response.catalog = {
          id: c.id,
          name: c.name,
          year: c.year,
          setName: c.setName,
          manufacturer: c.manufacturer,
          cardNumber: c.cardNumber,
          imageUrl: c.imageUrl ?? null,
          parallels: c.parallels ?? [],
        };
      }

      if (pricingResult.status === 'fulfilled') {
        const p = pricingResult.value;
        response.pricing = {
          avgPrice: p.avgPrice ?? null,
          minPrice: p.minPrice ?? null,
          maxPrice: p.maxPrice ?? null,
          salesCount: p.salesCount ?? null,
          lastSalePrice: p.lastSalePrice ?? null,
          lastSaleDate: p.lastSaleDate ?? null,
          currency: p.currency ?? 'AUD',
        };
      }

      logger.info(`[CARDSIGHT] Identified card ${cardId} (${response.card.name}) confidence=${best.confidence}`);

      // Background: persist market valuations for this card (CardSight + eBay + PSA)
      refreshCardMarketData({
        cardId,
        cardName: response.card.name  ?? null,
        setName:  response.card.setName ?? null,
      }).catch(err => logger.warn(`[CARDSIGHT] Background market refresh failed: ${err.message}`));

      // Optionally persist cardsight_card_id to a vault_item if caller passes one
      const vaultItemId = req.body?.vault_item_id;
      if (vaultItemId && req.user.id) {
        await supabase
          .from('vault_items')
          .update({
            cardsight_card_id: cardId,
            cardsight_set_id: best.card?.setId ?? null,
            cardsight_identified_at: new Date().toISOString(),
          })
          .eq('id', vaultItemId)
          .eq('owner_id', req.user.id);
      }
    } else {
      logger.info(`[CARDSIGHT] Set-level or low-confidence match: setId=${best.card?.setId} confidence=${best.confidence}`);
    }

    res.json(response);
  }
);

// ─── GET /cardsight/pricing/:cardId ──────────────────────────────────────────
// Fetch current pricing for a known CardSight card ID.
router.get('/pricing/:cardId', async (req, res) => {
  const { cardId } = req.params;
  const { parallel_id, grade_id, period, listing_type } = req.query;

  const client = getCardSightClient();
  const data = await client.pricing.get(cardId, {
    ...(parallel_id && { parallel_id }),
    ...(grade_id && { grade_id }),
    ...(period && { period }),
    ...(listing_type && { listing_type }),
  });

  res.json(data);
});

// ─── GET /cardsight/catalog/search ───────────────────────────────────────────
// Fuzzy search across cards, sets, and releases.
router.get('/catalog/search', async (req, res) => {
  const { q, type, year, segment } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: 'q is required' });

  const client = getCardSightClient();
  const data = await client.catalog.search({
    q: q.trim(),
    ...(type && { type }),
    ...(year && { year }),
    ...(segment && { segment }),
  });

  res.json(data);
});

// ─── GET /cardsight/marketplace/:cardId ──────────────────────────────────────
// Active marketplace listings for a card.
router.get('/marketplace/:cardId', async (req, res) => {
  const { cardId } = req.params;
  const client = getCardSightClient();
  const data = await client.marketplace.get(cardId);
  res.json(data);
});

export default router;
