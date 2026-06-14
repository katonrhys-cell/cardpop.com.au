import { Router } from 'express';
import {
  getHighestConfidenceDetection,
  isExactMatch,
  isSetLevelMatch,
  hasGrading,
  hasParallel,
  getParallelInfo,
  getFieldValue,
} from 'cardsightai';
import { getCardSightClient, summarisePricingAud, getSegmentName } from '../utils/cardSightClient.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { supabaseAuth } from '../middleware/pocketbase-auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import supabase from '../utils/supabaseClient.js';
import { refreshCardMarketData } from '../utils/marketDataService.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(supabaseAuth);

// CardSight pricing accepts these listing types; anything else is dropped
const VALID_LISTING_TYPES = new Set(['auction', 'fixed', 'both']);

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
    const file = req.files[0];
    // Wrap the buffer in a File so the multipart part carries the validated
    // MIME type and a filename — a bare buffer is sent as application/octet-stream,
    // which CardSight can fail to process.
    const image = new File(
      [file.buffer],
      file.originalname || `card.${file.detectedExt ?? 'jpg'}`,
      { type: file.mimetype }
    );

    // 1. Identify the card
    const { data: identifyResult } = await client.identify.card(image);

    if (!identifyResult?.detections?.length) {
      logger.info(
        `[CARDSIGHT] No detections: requestId=${identifyResult?.requestId} success=${identifyResult?.success} ` +
        `processingTime=${identifyResult?.processingTime} messages=${JSON.stringify(identifyResult?.messages ?? [])}`
      );
      return res.json({
        identified: false,
        message: 'No card detected in the image.',
        serverMessages: identifyResult?.messages ?? [],
      });
    }

    const best = getHighestConfidenceDetection(identifyResult);
    if (!best) {
      return res.json({ identified: false, message: 'Could not identify card with sufficient confidence.' });
    }

    const segmentName = await getSegmentName(best.card?.segmentId);

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
        cardNumber: best.card?.number ?? null,
        manufacturer: best.card?.manufacturer ?? null,
        segment: segmentName,
        rarity: getFieldValue(best, 'Rarity') ?? null,
        hp: getFieldValue(best, 'HP') ?? null,
        artist: getFieldValue(best, 'Artist') ?? null,
      },
      grading: hasGrading(best)
        ? {
            company: best.grading.company?.name ?? null,
            grade: best.grading.grade?.value ?? null,
            condition: best.grading.grade?.condition ?? null,
          }
        : null,
      parallel: hasParallel(best) ? getParallelInfo(best) : null,
    };

    // 2. If we have an exact card match, fetch catalog detail + pricing
    if (isExactMatch(best) && best.card?.id) {
      const cardId = best.card.id;
      const [catalogResult, pricingResult] = await Promise.allSettled([
        client.catalog.cards.get(cardId),
        client.pricing.get(cardId),
      ]);

      if (catalogResult.status === 'fulfilled' && catalogResult.value.data) {
        const c = catalogResult.value.data;
        response.catalog = {
          id: c.id,
          name: c.name,
          year: c.releaseYear ?? null,
          setName: c.setName ?? null,
          releaseName: c.releaseName ?? null,
          cardNumber: c.number ?? null,
          numberedTo: c.numberedTo ?? null,
          parallels: c.parallels ?? [],
        };
      }

      if (pricingResult.status === 'fulfilled') {
        const summary = await summarisePricingAud(pricingResult.value.data);
        if (summary) response.pricing = summary;
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
// Fetch current pricing for a known CardSight card ID, flattened to aggregates.
router.get('/pricing/:cardId', async (req, res) => {
  const { cardId } = req.params;
  const { parallel_id, grade_id, period, listing_type } = req.query;

  const client = getCardSightClient();
  const { data } = await client.pricing.get(cardId, {
    ...(parallel_id && { parallel_id }),
    ...(grade_id && { grade_id }),
    ...(period && { period }),
    ...(VALID_LISTING_TYPES.has(listing_type) && { listing_type }),
  });

  const summary = await summarisePricingAud(data);
  res.json({
    card_id: cardId,
    avg_price: summary?.avgPrice ?? null,
    min_price: summary?.minPrice ?? null,
    max_price: summary?.maxPrice ?? null,
    count: summary?.salesCount ?? 0,
    last_sale_price: summary?.lastSalePrice ?? null,
    last_sale_date: summary?.lastSaleDate ?? null,
    currency: summary?.currency ?? 'AUD',
  });
});

// ─── GET /cardsight/autocomplete ─────────────────────────────────────────────
// Lightweight card-name lookup used to resolve a name to a CardSight card ID.
router.get('/autocomplete', async (req, res) => {
  const { q, take } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: 'q is required' });

  const client = getCardSightClient();
  const { data } = await client.catalog.search({
    q: q.trim(),
    type: 'card',
    ...(take && { take: Number(take) }),
  });

  res.json({ results: data?.results ?? [] });
});

// ─── GET /cardsight/catalog/search ───────────────────────────────────────────
// Fuzzy search across cards, sets, and releases.
router.get('/catalog/search', async (req, res) => {
  const { q, type, year, segment } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: 'q is required' });

  const client = getCardSightClient();
  const { data } = await client.catalog.search({
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
  const { data } = await client.marketplace.get(cardId);
  res.json(data);
});

export default router;
