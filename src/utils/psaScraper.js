import { load } from 'cheerio';
import logger from './logger.js';
import { convertUsdToAud, getExchangeRateInfo } from './exchangeRates.js';

const PSA_BASE_URL = 'https://www.psacard.com/cert';

async function fetchPSACertification(certNumber) {
  if (!certNumber) {
    throw new Error('Certificate number is required');
  }

  try {
    logger.info(`[PSA_SCRAPER] Fetching cert: ${certNumber}`);

    const url = `${PSA_BASE_URL}/${certNumber}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      logger.warn(`[PSA_SCRAPER] HTTP ${response.status} for cert ${certNumber}`);
      return null;
    }

    const html = await response.text();
    const $ = load(html);

    // Extract data from PSA page
    const psaEstimateUsd = extractPSAEstimate($);
    const psaEstimateAud = psaEstimateUsd ? await convertUsdToAud(psaEstimateUsd) : null;
    const exchangeRateInfo = psaEstimateUsd ? await getExchangeRateInfo() : null;

    const certData = {
      certNumber,
      cardTitle: extractCardTitle($),
      cardYear: extractYear($),
      cardSet: extractSet($),
      cardNumber: extractCardNumber($),
      grade: extractGrade($),
      gradeCategory: extractGradeCategory($),
      psaEstimate: psaEstimateUsd,
      psaEstimateAud,
      exchangeRate: exchangeRateInfo?.rate,
      lastExchangeRateUpdate: exchangeRateInfo?.lastUpdatedAt,
      population: extractPopulation($),
      popHigher: extractPopHigher($),
      frontImage: extractFrontImage($),
      backImage: extractBackImage($),
      variant: extractVariant($),
      condition: extractCondition($),
    };

    logger.info(`[PSA_SCRAPER] Successfully parsed cert ${certNumber}`);
    return certData;
  } catch (error) {
    logger.error(`[PSA_SCRAPER] Error fetching cert ${certNumber}: ${error.message}`);
    throw error;
  }
}

function extractCardTitle($) {
  // Try multiple selectors for card title
  let title = $('h1').first().text().trim();
  if (!title) {
    title = $('[data-testid="cert-title"]').first().text().trim();
  }
  if (!title) {
    title = $('h2').first().text().trim();
  }
  if (!title) {
    title = $('*[class*="title"]').first().text().trim();
  }
  return title || null;
}

function extractYear($) {
  const title = extractCardTitle($);
  if (!title) {
    // Alternative: look for year in dedicated field
    const year = $('[data-testid="year"]').first().text().trim();
    if (year) return year;
  }
  if (!title) return null;
  const match = title.match(/(\d{4})/);
  return match ? match[1] : null;
}

function extractSet($) {
  // Try dedicated set field first
  let set = $('[data-testid="set"]').first().text().trim();
  if (set) return set;

  // Try parsing from title
  const title = extractCardTitle($);
  if (!title) return null;
  const parts = title.split('#');
  if (parts[0]) {
    const setPart = parts[0].trim().split(/\s+/).slice(1).join(' ');
    return setPart || null;
  }
  return null;
}

function extractCardNumber($) {
  // Try dedicated field
  let cardNum = $('[data-testid="card-number"]').first().text().trim();
  if (cardNum) return cardNum;

  // Parse from title
  const title = extractCardTitle($);
  if (!title) return null;
  const match = title.match(/#(\d+)/);
  return match ? match[1] : null;
}

function extractGrade($) {
  // Try dedicated grade field first
  let gradeText = $('[data-testid="grade"]').first().text().trim();
  if (!gradeText) {
    gradeText = $('[class*="grade"][class*="value"]').first().text().trim();
  }
  if (!gradeText) {
    gradeText = $('*:contains("Grade:")').next().text().trim();
  }
  const match = gradeText.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function extractGradeCategory($) {
  // e.g., "MINT", "GEM MINT", "EXCELLENT", etc.
  let gradeText = $('[data-testid="grade-category"]').first().text().trim();
  if (!gradeText) {
    gradeText = $('[class*="grade"][class*="label"]').first().text().trim();
  }
  if (!gradeText) {
    gradeText = $('*:contains("Grade:")').next().text().trim();
  }
  const match = gradeText.match(/^([A-Z\s]+?)(?:\s+\d|$)/);
  return match ? match[1].trim() : null;
}

function extractPSAEstimate($) {
  // Look for price estimate in various formats
  let estimateText = $('[data-testid="psa-estimate"]').first().text();
  if (!estimateText) {
    estimateText = $('[class*="estimate"][class*="price"]').first().text();
  }
  if (!estimateText) {
    estimateText = $('*:contains("PSA Estimate")').next().text();
  }
  const match = estimateText.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
  if (match) {
    const priceStr = match[1].replace(/,/g, '');
    return parseFloat(priceStr);
  }
  return null;
}

function extractPopulation($) {
  // PSA Population at this grade
  let popText = $('[data-testid="population"]').first().text();
  if (!popText) {
    popText = $('[class*="population"]').first().text();
  }
  if (!popText) {
    popText = $('*:contains("Population")').next().text();
  }
  const match = popText.match(/[\d,]+/);
  if (match) {
    return parseInt(match[0].replace(/,/g, ''), 10);
  }
  return null;
}

function extractPopHigher($) {
  // PSA Pop Higher (graded higher)
  let popHigherText = $('[data-testid="pop-higher"]').first().text();
  if (!popHigherText) {
    popHigherText = $('[class*="pop-higher"]').first().text();
  }
  if (!popHigherText) {
    popHigherText = $('*:contains("Pop Higher")').next().text();
  }
  const match = popHigherText.match(/[\d,]+/);
  if (match) {
    return parseInt(match[0].replace(/,/g, ''), 10);
  }
  return null;
}

function extractFrontImage($) {
  // Front image of the card
  let img = $('[data-testid="card-front-image"]').first();
  if (!img.length) {
    img = $('img[alt*="front" i]').first();
  }
  if (!img.length) {
    img = $('[class*="card-image"][class*="front"]').first();
  }
  if (!img.length) {
    img = $('img').first(); // fallback to first image
  }
  return img.attr('src') || img.attr('data-src') || null;
}

function extractBackImage($) {
  // Back image of the card
  let img = $('[data-testid="card-back-image"]').first();
  if (!img.length) {
    img = $('img[alt*="back" i]').first();
  }
  if (!img.length) {
    img = $('[class*="card-image"][class*="back"]').first();
  }
  if (!img.length) {
    img = $('img').eq(1); // fallback to second image
  }
  return img.attr('src') || img.attr('data-src') || null;
}

function extractVariant($) {
  // Card variant info (parallel, autograph, etc.)
  let variantText = $('[data-testid="variant"]').first().text().trim();
  if (!variantText) {
    variantText = $('[class*="variant"]').first().text().trim();
  }
  return variantText || null;
}

function extractCondition($) {
  // Detailed condition notes
  let conditionText = $('[data-testid="condition"]').first().text().trim();
  if (!conditionText) {
    conditionText = $('[class*="condition"]').first().text().trim();
  }
  return conditionText || null;
}

export { fetchPSACertification };
