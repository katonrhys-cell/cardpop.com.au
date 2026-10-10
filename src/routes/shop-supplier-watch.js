import express from 'express';
import crypto from 'node:crypto';
import { runSupplierPriceWatch } from '../services/supplierPriceWatchService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Constant-time compare so the bearer check can't leak the secret via timing.
const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

// Fail-closed, like every other cron entrypoint: with no CRON_SECRET the job
// refuses rather than letting anyone make the server fetch supplier pages.
const isAuthorisedCronCall = (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.warn('[SUPPLIER_PRICE] CRON_SECRET is not set — refusing /run (fail-closed).');
    return false;
  }
  return timingSafeEqualStr(req.headers.authorization || '', `Bearer ${secret}`);
};

/**
 * GET /shop-supplier-watch/run
 * Daily cron (.github/workflows/cron-daily.yml): re-checks the
 * supplier page of every shop product whose last check is a week old, and
 * bells admins about price changes. Reports only — never changes a price.
 */
router.get('/run', async (req, res) => {
  if (!isAuthorisedCronCall(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const summary = await runSupplierPriceWatch();
    res.json({ ...summary, results: undefined });
  } catch (error) {
    logger.error(`[SUPPLIER_PRICE] Run failed: ${error.message}`);
    res.status(502).json({ error: 'Supplier price check failed. Please try again later.' });
  }
});

export default router;
