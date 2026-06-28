import express from 'express';
import { fetchPSACertification } from '../utils/psaScraper.js';
import { psaApiClient } from '../utils/psaApiClient.js';
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
    let certData = null;

    // Try the official PSA API first if token is available
    if (process.env.PSA_API_TOKEN) {
      try {
        logger.info(`[PSA_ROUTE] Attempting PSA API lookup for ${certNumber}`);
        const apiResult = await psaApiClient.lookupCard({ gradingNumber: certNumber });
        if (apiResult) {
          certData = transformPSAApiResponse(apiResult);
        }
      } catch (apiError) {
        logger.warn(`[PSA_ROUTE] PSA API lookup failed: ${apiError.message}, falling back to scraper`);
      }
    }

    // Fall back to scraper if API didn't work
    if (!certData) {
      logger.info(`[PSA_ROUTE] Falling back to web scraper for ${certNumber}`);
      certData = await fetchPSACertification(certNumber);
    }

    if (!certData) {
      return res.status(404).json({ error: 'Certificate not found or unable to fetch PSA data' });
    }

    res.json(certData);
  } catch (error) {
    logger.error(`[PSA_ROUTE] Error: ${error.message}`);
    res.status(502).json({ error: 'Failed to fetch PSA certification data. PSA website may be temporarily unavailable.' });
  }
});

/**
 * Transform PSA API response to match the frontend's expected format
 */
function transformPSAApiResponse(apiResponse) {
  if (!apiResponse?.PSACert) {
    return null;
  }

  const cert = apiResponse.PSACert;
  return {
    certNumber: cert.CertNumber,
    cardTitle: cert.CardTitle || cert.CardName,
    cardYear: cert.CardYear,
    cardSet: cert.CardSet || cert.SetName,
    cardNumber: cert.CardNumber || cert.CardNum,
    grade: cert.Grade ? parseFloat(cert.Grade) : null,
    gradeCategory: cert.GradeCategory || null,
    psaEstimate: cert.PSAEstimate ? parseFloat(cert.PSAEstimate) : null,
    psaEstimateAud: cert.PSAEstimateAUD ? parseFloat(cert.PSAEstimateAUD) : null,
    exchangeRate: cert.ExchangeRate ? parseFloat(cert.ExchangeRate) : null,
    lastExchangeRateUpdate: cert.LastExchangeRateUpdate,
    population: cert.PopulationAtThisGrade ? parseInt(cert.PopulationAtThisGrade, 10) : null,
    popHigher: cert.PopulationHigher ? parseInt(cert.PopulationHigher, 10) : null,
    frontImage: cert.CardImageUrlFront || cert.FrontImageUrl,
    backImage: cert.CardImageUrlBack || cert.BackImageUrl,
    variant: cert.Variant,
    condition: cert.ConditionNotes || cert.Condition,
  };
}

export default router;
