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
        // The cert record and its images are two separate endpoints; fetch both
        // together. Images are best-effort (lookupImages never throws) so they
        // can't sink an otherwise-successful cert lookup.
        const [apiResult, images] = await Promise.all([
          psaApiClient.lookupCard({ gradingNumber: certNumber }),
          psaApiClient.lookupImages({ gradingNumber: certNumber }),
        ]);
        if (apiResult) {
          certData = transformPSAApiResponse(apiResult, images);
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

// Pull the first value that is present (not null/undefined/empty) from a list of
// candidate field names — the PSA Public API and the older assumed shape use
// different casings/names for the same datum, so we try each in turn.
function pick(obj, ...keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

function toInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

// Build a human-readable card title from the PSA Public API's structured fields
// (it has no single "title" field). e.g. "1999 Pokemon Game Charizard #4".
function buildCardTitle(cert) {
  const parts = [
    pick(cert, 'Year', 'CardYear'),
    pick(cert, 'Brand', 'CardSet', 'SetName'),
    pick(cert, 'Subject', 'CardTitle', 'CardName'),
    pick(cert, 'Variety', 'Variant'),
  ].filter(Boolean);
  const number = pick(cert, 'CardNumber', 'CardNum');
  const title = parts.join(' ').trim();
  if (!title) return pick(cert, 'CardTitle', 'CardName');
  return number ? `${title} #${number}` : title;
}

/**
 * Transform the PSA Public API response into the shape the frontend expects.
 *
 * The Public API returns a `PSACert` object with fields like `Year`, `Brand`,
 * `Subject`, `CardGrade`, `TotalPopulation` and `PopulationHigher` — NOT the
 * `CardYear` / `CardSet` / `Grade` names previously assumed here. Each field is
 * read defensively so both shapes work. Price/estimate data is not part of the
 * Public API (only the scraper provides it), so those fields stay null here.
 *
 * @param {object} apiResponse — raw PSA API JSON ({ PSACert: {...} })
 * @param {Array}  images      — result of GetImagesByCertNumber, best-effort
 */
function transformPSAApiResponse(apiResponse, images = []) {
  if (!apiResponse?.PSACert) {
    return null;
  }

  const cert = apiResponse.PSACert;

  // CardGrade / GradeDescription are strings like "GEM-MT 10" — keep the label
  // for display and derive a numeric value for grade comparisons.
  const gradeLabel = pick(cert, 'CardGrade', 'GradeDescription', 'Grade');
  const gradeMatch = gradeLabel != null ? String(gradeLabel).match(/(\d+(?:\.\d+)?)/) : null;

  // Images: [{ IsFrontImage: true, ImageURL: '...' }, ...]
  const imageList = Array.isArray(images) ? images : [];
  const front = imageList.find((i) => i?.IsFrontImage)?.ImageURL
    ?? pick(cert, 'CardImageUrlFront', 'FrontImageUrl');
  const back = imageList.find((i) => i && i.IsFrontImage === false)?.ImageURL
    ?? pick(cert, 'CardImageUrlBack', 'BackImageUrl');

  return {
    certNumber: pick(cert, 'CertNumber'),
    cardTitle: buildCardTitle(cert),
    cardYear: pick(cert, 'Year', 'CardYear'),
    cardSet: pick(cert, 'Brand', 'CardSet', 'SetName'),
    cardNumber: pick(cert, 'CardNumber', 'CardNum'),
    grade: gradeMatch ? parseFloat(gradeMatch[1]) : null,
    gradeLabel: gradeLabel != null ? String(gradeLabel) : null,
    gradeCategory: pick(cert, 'GradeCategory'),
    // Richer PSA-held fields now surfaced to the buyer.
    subject: pick(cert, 'Subject'),
    brand: pick(cert, 'Brand'),
    category: pick(cert, 'Category'),
    variety: pick(cert, 'Variety'),
    labelType: pick(cert, 'LabelType'),
    specNumber: pick(cert, 'SpecNumber'),
    isDualCert: cert.IsDualCert === true || null,
    isPsaDna: cert.IsPSADNA === true || null,
    psaEstimate: toNumber(pick(cert, 'PSAEstimate')),
    psaEstimateAud: toNumber(pick(cert, 'PSAEstimateAUD')),
    exchangeRate: toNumber(pick(cert, 'ExchangeRate')),
    lastExchangeRateUpdate: pick(cert, 'LastExchangeRateUpdate'),
    population: toInt(pick(cert, 'TotalPopulation', 'PopulationAtThisGrade')),
    populationWithQualifier: toInt(pick(cert, 'TotalPopulationWithQualifier')),
    popHigher: toInt(pick(cert, 'PopulationHigher')),
    frontImage: front,
    backImage: back,
    variant: pick(cert, 'Variety', 'Variant'),
    condition: pick(cert, 'ConditionNotes', 'Condition'),
  };
}

export default router;
