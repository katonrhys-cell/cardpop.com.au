import express from 'express';
import { fetchPSACertification } from '../utils/psaScraper.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /psa/cert/:certNumber
 * Fetch PSA certification data by certificate number
 *
 * Params:
 *   certNumber (required) — e.g., "138138870"
 *
 * Response:
 *   {
 *     certNumber, cardTitle, cardYear, cardSet, cardNumber, grade,
 *     gradeCategory, psaEstimate, population, popHigher, frontImage,
 *     backImage, variant, condition
 *   }
 */
router.get('/cert/:certNumber', async (req, res) => {
  const { certNumber } = req.params;

  if (!certNumber?.trim()) {
    return res.status(400).json({ error: 'certNumber parameter is required' });
  }

  logger.info(`[PSA_ROUTE] Fetching cert: ${certNumber}`);

  try {
    const certData = await fetchPSACertification(certNumber);

    if (!certData) {
      return res.status(404).json({ error: 'Certificate not found or unable to fetch PSA data' });
    }

    res.json(certData);
  } catch (error) {
    logger.error(`[PSA_ROUTE] Error: ${error.message}`);
    res.status(502).json({ error: 'Failed to fetch PSA certification data. PSA website may be temporarily unavailable.' });
  }
});

export default router;
