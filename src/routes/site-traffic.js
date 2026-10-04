import express from 'express';
import crypto from 'node:crypto';
import { syncSiteTraffic, Ga4NotConfiguredError } from '../services/siteTrafficService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Constant-time compare so the bearer check can't leak the secret via timing.
const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

// Fail-closed, like every other cron entrypoint.
const isAuthorisedCronCall = (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.warn('[SITE_TRAFFIC] CRON_SECRET is not set — refusing /sync (fail-closed).');
    return false;
  }
  return timingSafeEqualStr(req.headers.authorization || '', `Bearer ${secret}`);
};

/**
 * GET /site-traffic/sync
 * Nightly cron (.github/workflows/cron-site-traffic.yml): pulls visitor
 * counts from GA4 into site_traffic_daily / site_traffic_summary for the home
 * page stats strip and the admin dashboard. 503 until GA4 is configured, so
 * the Actions run stays red as a reminder rather than silently doing nothing.
 */
router.get('/sync', async (req, res) => {
  if (!isAuthorisedCronCall(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const summary = await syncSiteTraffic();
    res.json(summary);
  } catch (error) {
    if (error instanceof Ga4NotConfiguredError) {
      logger.warn(`[SITE_TRAFFIC] ${error.message}`);
      return res.status(503).json({ error: error.message });
    }
    logger.error(`[SITE_TRAFFIC] Sync failed: ${error.message}`);
    res.status(502).json({ error: 'Site traffic sync failed. Please try again later.' });
  }
});

export default router;
