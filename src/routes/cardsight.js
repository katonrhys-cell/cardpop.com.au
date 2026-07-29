import { Router } from 'express';
import {
  isExactMatch,
  isSetLevelMatch,
  hasGrading,
  hasParallel,
  getParallelInfo,
  getFieldValue,
} from 'cardsightai';
import { getCardSightClient, summarisePricingAud, getSegmentName } from '../utils/cardSightClient.js';
import { confidenceRank, confidenceScore, confidenceLabel } from '../../utils/cardsightConfidence.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import supabase from '../utils/supabaseClient.js';
import { refreshCardMarketData } from '../utils/marketDataService.js';
import { getSegmentsForCollection } from '../utils/collectionSegmentMap.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(supabaseAuth);

// CardSight pricing accepts these listing types; anything else is dropped
const VALID_LISTING_TYPES = new Set(['auction', 'fixed', 'both']);

// How many runner-up detections to hand back so the seller can correct a
// mis-pick without re-scanning.
const MAX_ALTERNATIVES = 4;

/**
 * Match specificity: an exact card hit (the detection carries a card id) is
 * always a better answer than a set-level guess, which in turn beats a
 * detection that resolved to neither.
 */
function matchSpecificity(detection) {
  if (isExactMatch(detection)) return 2;
  if (isSetLevelMatch(detection)) return 1;
  return 0;
}

/**
 * Orders detections merged from the per-segment fan-out.
 *
 * Each segment is queried independently and answers with its best guess
 * *within that segment*, so a Pokemon card scanned without a collection still
 * yields a plausible-looking basketball detection. Ordering therefore has to be
 * explicit. The SDK's `getHighestConfidenceDetection` sorts on the confidence
 * enum alone, and because that enum only has three levels most cross-segment
 * scans tie — leaving the winner to be decided by the order the segments happen
 * to sit in the fan-out array (basketball first, pokemon fifth). That is what
 * made scans return confident-looking cards from the wrong sport.
 *
 * @param {Array<{detection: object, segment: string}>} candidates
 * @returns {Array<{detection: object, segment: string}>} new array, best first
 */
function rankCandidates(candidates) {
  return [...candidates].sort((a, b) =>
    (matchSpecificity(b.detection) - matchSpecificity(a.detection)) ||
    (confidenceRank(b.detection.confidence) - confidenceRank(a.detection.confidence))
  );
}

/**
 * True when a runner-up from a *different* segment is just as good as the
 * winner — i.e. the fan-out produced a genuine cross-sport collision and the
 * pick is effectively arbitrary. The UI uses this to ask for confirmation
 * instead of presenting the guess as a verified catalog match.
 */
function hasAmbiguousWinner(ranked) {
  const [best, ...rest] = ranked;
  if (!best) return false;
  return rest.some(c =>
    c.segment !== best.segment &&
    matchSpecificity(c.detection) === matchSpecificity(best.detection) &&
    confidenceRank(c.detection.confidence) === confidenceRank(best.detection.confidence)
  );
}

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

    let client;
    try {
      client = getCardSightClient();
    } catch (err) {
      logger.error(`[CARDSIGHT] Client init failed: ${err.message}`);
      return res.status(503).json({ identified: false, apiError: true, message: 'Card identification service is not configured.' });
    }

    try {
      const file = req.files[0];
      // Wrap the buffer in a File so the multipart part carries the validated
      // MIME type and a filename — a bare buffer is sent as application/octet-stream,
      // which CardSight can fail to process.
      const image = new File(
        [file.buffer],
        file.originalname || `card.${file.detectedExt ?? 'jpg'}`,
        { type: file.mimetype }
      );

      // 1. Identify the card across relevant segments based on collection.
      // If collection is specified, only search those segments; otherwise try all.
      const collection = req.body?.collection || '';
      const SEGMENTS = getSegmentsForCollection(collection);

      // A collection CardSight has no catalog for (Magic, One Piece, AFL, …).
      // Asking anyway is worse than not asking: every segment answers with its
      // best guess *within that segment*, so the only possible reply is a
      // confident-looking card from the wrong hobby. Bail out and let the
      // caller fall back to OCR + the public TCG catalogue.
      if (!SEGMENTS.length) {
        logger.info(`[CARDSIGHT] Skipping identify — "${collection}" is not in the CardSight catalog`);
        return res.json({
          identified: false,
          unsupportedCollection: true,
          message: `${collection} cards aren't in the CardSight catalog.`,
        });
      }

      const segmentResults = await Promise.allSettled(
        SEGMENTS.map(seg => client.identify.cardBySegment(seg, image))
      );

      // Merge every segment's detections, keeping the segment each one came
      // from — it is the only way to tell a cross-sport collision apart from
      // two genuine candidates within one segment.
      const candidates = [];
      let serverMessages = [];
      segmentResults.forEach((r, i) => {
        const segment = SEGMENTS[i];
        if (r.status === 'fulfilled' && r.value?.data) {
          for (const detection of r.value.data.detections ?? []) {
            if (detection?.card) candidates.push({ detection, segment });
          }
          serverMessages = serverMessages.concat(r.value.data.messages ?? []);
        } else if (r.status === 'rejected') {
          logger.warn(`[CARDSIGHT] Segment "${segment}" lookup failed: ${r.reason?.message ?? r.reason}`);
        }
      });

      if (!candidates.length) {
        logger.info(`[CARDSIGHT] No detections. collection=${collection} segments=[${SEGMENTS.join(', ')}] messages=${JSON.stringify(serverMessages)}`);
        return res.json({
          identified: false,
          message: 'No card detected in the image.',
          serverMessages,
        });
      }

      // Rank explicitly (match specificity first, then confidence) rather than
      // letting the fan-out array order break the very common confidence tie.
      const ranked = rankCandidates(candidates);
      const best = ranked[0]?.detection;
      if (!best) {
        return res.json({ identified: false, message: 'Could not identify card with sufficient confidence.' });
      }

      const ambiguous = hasAmbiguousWinner(ranked);
      const segmentName = await getSegmentName(best.card?.segmentId);

      // Runner-ups worth offering as a correction: real matches only, one entry
      // per distinct card, so the seller can fix a mis-pick without re-scanning.
      const seen = new Set([best.card?.id ?? best.card?.setId]);
      const alternatives = [];
      for (const { detection, segment } of ranked.slice(1)) {
        if (alternatives.length >= MAX_ALTERNATIVES) break;
        if (matchSpecificity(detection) === 0) continue;
        const key = detection.card?.id ?? detection.card?.setId;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        alternatives.push({
          id: detection.card?.id ?? null,
          name: detection.card?.name ?? null,
          year: detection.card?.year ?? null,
          setName: detection.card?.setName ?? null,
          setId: detection.card?.setId ?? null,
          cardNumber: detection.card?.number ?? null,
          manufacturer: detection.card?.manufacturer ?? null,
          segment: await getSegmentName(detection.card?.segmentId) ?? segment,
          confidence: detection.confidence,
          confidenceLabel: confidenceLabel(detection.confidence),
          exactMatch: isExactMatch(detection),
        });
      }

      const response = {
        identified: true,
        // `confidence` stays the raw CardSight enum for compatibility;
        // consumers should read the derived numeric/label fields.
        confidence: best.confidence,
        confidenceLabel: confidenceLabel(best.confidence),
        confidenceScore: confidenceScore(best.confidence),
        ambiguous,
        alternatives,
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

        logger.info(`[CARDSIGHT] Identified card ${cardId} (${response.card.name}) confidence=${best.confidence} segment=${ranked[0].segment} ambiguous=${ambiguous} candidates=${candidates.length} collection=${collection}`);

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
        logger.info(`[CARDSIGHT] Set-level or low-confidence match: setId=${best.card?.setId} confidence=${best.confidence} segment=${ranked[0].segment} ambiguous=${ambiguous} candidates=${candidates.length} collection=${collection}`);
      }

      res.json(response);
    } catch (err) {
      logger.error(`[CARDSIGHT] identify error: ${err.message}`, err.stack);
      return res.status(502).json({ identified: false, apiError: true, message: `Card identification failed: ${err.message}` });
    }
  }
);

// ─── GET /cardsight/status ───────────────────────────────────────────────────
// Quick health check: verifies the API key env var is set (no live API call).
router.get('/status', (req, res) => {
  const key = process.env.CARDSIGHT_API_KEY || process.env.CARDSIGHTAI_API_KEY;
  if (!key) {
    return res.status(500).json({ ok: false, error: 'CARDSIGHT_API_KEY is not set in environment variables' });
  }
  res.json({ ok: true, keyConfigured: true, keyPrefix: key.slice(0, 6) + '...' });
});

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
