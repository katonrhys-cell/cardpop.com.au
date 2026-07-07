import express from 'express';
import crypto from 'node:crypto';
import supabase from '../utils/supabaseClient.js';
import { buildSnapshotForCard, refreshTrackedCards } from '../utils/cardPriceSnapshots.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Constant-time string compare so the bearer check doesn't leak the secret via
// response timing.
const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

// Vercel Cron includes "Authorization: Bearer <CRON_SECRET>" automatically when
// the CRON_SECRET env var is set on the project. This is fail-CLOSED: if the
// secret isn't configured, the full-refresh endpoint refuses rather than letting
// anyone trigger the eBay-hitting job anonymously. CRON_SECRET must be set in the
// production environment for the daily cron to run.
const isAuthorisedCronCall = (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.warn('[PRICES] CRON_SECRET is not set — refusing /refresh (fail-closed). Set CRON_SECRET to enable the daily cron.');
    return false;
  }
  return timingSafeEqualStr(req.headers.authorization || '', `Bearer ${secret}`);
};

/**
 * GET /prices/refresh
 * Daily cron entrypoint: snapshot every active tracked card missing today's
 * price observation. Idempotent within a UTC day.
 */
router.get('/refresh', async (req, res) => {
  if (!isAuthorisedCronCall(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const summary = await refreshTrackedCards();
    logger.info(`[PRICES_REFRESH] ${JSON.stringify(summary)}`);
    res.json(summary);
  } catch (error) {
    logger.error(`[PRICES_REFRESH] ${error.message}`);
    res.status(502).json({ error: 'Price refresh failed. Please try again later.' });
  }
});

/**
 * POST /prices/refresh-card
 * On-demand fallback used by the price pages: if a visitor lands on a card
 * whose snapshot is missing for today (cron hasn't reached it, or a cold
 * catalogue addition), refresh just that card. No-op when today's snapshot
 * already exists, so repeated calls cost nothing.
 */
router.post('/refresh-card', async (req, res) => {
  const slug = String(req.body?.slug || '').trim();
  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    const { data: card, error: cardError } = await supabase
      .from('tracked_cards')
      .select('id, slug, search_query')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle();
    if (cardError) throw new Error(cardError.message);
    if (!card) return res.status(404).json({ error: 'Unknown card' });

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing, error: existingError } = await supabase
      .from('card_price_snapshots')
      .select('*')
      .eq('card_id', card.id)
      .eq('snapshot_date', today)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) return res.json({ refreshed: false, snapshot: existing });

    const snapshot = await buildSnapshotForCard(card);
    logger.info(`[PRICES_REFRESH_CARD] Refreshed "${slug}"`);
    res.json({ refreshed: true, snapshot });
  } catch (error) {
    logger.error(`[PRICES_REFRESH_CARD] ${error.message}`);
    res.status(502).json({ error: 'Price refresh unavailable. Please try again later.' });
  }
});

export default router;
