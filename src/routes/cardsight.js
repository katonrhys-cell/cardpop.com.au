import { Router } from 'express';
import { callCardsight } from '../utils/cardsightClient.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { supabaseAuth } from '../middleware/pocketbase-auth.js';
import logger from '../utils/logger.js';

const router = Router();

// ── Catalog search ─────────────────────────────────────────────────────────────
// GET /cardsight/search?q=charizard&segment=pokemon&take=20&skip=0
router.get('/search', async (req, res) => {
  const { q, segment, type, year, take = 20, skip = 0 } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  try {
    const params = new URLSearchParams({ q, take, skip });
    if (segment) params.set('segment', segment);
    if (type) params.set('type', type);
    if (year) params.set('year', year);

    const data = await callCardsight(`/v1/catalog/search?${params}`);
    res.json(data);
  } catch (err) {
    logger.error(`[CARDSIGHT] /search error: ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

// ── Autocomplete ───────────────────────────────────────────────────────────────
// GET /cardsight/autocomplete?q=pikachu&take=10
router.get('/autocomplete', async (req, res) => {
  const { q, take = 10 } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  try {
    const params = new URLSearchParams({ query: q, take });
    const data = await callCardsight(`/v1/autocomplete/cards?${params}`);
    res.json(data);
  } catch (err) {
    logger.error(`[CARDSIGHT] /autocomplete error: ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

// ── Card details ───────────────────────────────────────────────────────────────
// GET /cardsight/card/:cardId
router.get('/card/:cardId', async (req, res) => {
  try {
    const data = await callCardsight(`/v1/catalog/cards/${req.params.cardId}`);
    res.json(data);
  } catch (err) {
    logger.error(`[CARDSIGHT] /card error: ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

// ── Pricing ────────────────────────────────────────────────────────────────────
// GET /cardsight/pricing/:cardId?period=30d&parallel_id=...&grade_id=...
router.get('/pricing/:cardId', async (req, res) => {
  const { period = '30d', parallel_id, grade_id, listing_type, limit } = req.query;

  try {
    const params = new URLSearchParams({ period });
    if (parallel_id) params.set('parallel_id', parallel_id);
    if (grade_id) params.set('grade_id', grade_id);
    if (listing_type) params.set('listing_type', listing_type);
    if (limit) params.set('limit', limit);

    const data = await callCardsight(`/v1/pricing/${req.params.cardId}?${params}`);
    res.json(data);
  } catch (err) {
    logger.error(`[CARDSIGHT] /pricing error: ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

// ── Bulk pricing ───────────────────────────────────────────────────────────────
// POST /cardsight/pricing/bulk  body: { card_ids: [...], period, listing_type }
router.post('/pricing/bulk', async (req, res) => {
  const { card_ids, period = '30d', listing_type } = req.body;
  if (!Array.isArray(card_ids) || !card_ids.length) {
    return res.status(400).json({ error: 'card_ids array is required' });
  }

  try {
    const data = await callCardsight('/v1/pricing/bulk', {
      method: 'POST',
      body: JSON.stringify({ card_ids, period, listing_type }),
    });
    res.json(data);
  } catch (err) {
    logger.error(`[CARDSIGHT] /pricing/bulk error: ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

// ── Marketplace listings ───────────────────────────────────────────────────────
// GET /cardsight/marketplace/:cardId?parallel_id=...&grade_id=...
router.get('/marketplace/:cardId', async (req, res) => {
  const { parallel_id, grade_id, listing_type, limit } = req.query;

  try {
    const params = new URLSearchParams();
    if (parallel_id) params.set('parallel_id', parallel_id);
    if (grade_id) params.set('grade_id', grade_id);
    if (listing_type) params.set('listing_type', listing_type);
    if (limit) params.set('limit', limit);

    const qs = params.toString() ? `?${params}` : '';
    const data = await callCardsight(`/v1/marketplace/${req.params.cardId}${qs}`);
    res.json(data);
  } catch (err) {
    logger.error(`[CARDSIGHT] /marketplace error: ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

// ── Card identification from image (requires auth — vault use) ─────────────────
// POST /cardsight/identify  multipart field: image (single file)
router.post(
  '/identify',
  supabaseAuth,
  uploadFiles({
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fieldName: 'image',
    maxCount: 1,
  }),
  async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Authentication required' });

    const [file] = req.files || [];
    if (!file) return res.status(400).json({ error: 'An image file is required (field: image)' });

    try {
      const form = new FormData();
      form.append('image', new Blob([file.buffer], { type: file.mimetype }), file.originalname);

      const data = await callCardsight('/v1/identify', {
        method: 'POST',
        body: form,
      });
      res.json(data);
    } catch (err) {
      logger.error(`[CARDSIGHT] /identify error: ${err.message}`);
      res.status(502).json({ error: err.message });
    }
  }
);

export default router;
