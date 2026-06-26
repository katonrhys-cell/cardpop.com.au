import cheerio from 'cheerio';
import logger from './logger.js';

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
        'User-Agent': 'Mozilla/5.0 (compatible; CardPopBot/1.0)',
      },
    });

    if (!response.ok) {
      logger.warn(`[PSA_SCRAPER] HTTP ${response.status} for cert ${certNumber}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract data from PSA page
    const certData = {
      certNumber,
      cardTitle: extractCardTitle($),
      cardYear: extractYear($),
      cardSet: extractSet($),
      cardNumber: extractCardNumber($),
      grade: extractGrade($),
      gradeCategory: extractGradeCategory($),
      psaEstimate: extractPSAEstimate($),
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
  // PSA page structure: <h1> or heading with card title
  // Common selectors: h1, .cert-title, .card-title
  let title = $('h1').first().text().trim();
  if (!title) {
    title = $('.cert-title, .card-title').first().text().trim();
  }
  return title || null;
}

function extractYear($) {
  const title = extractCardTitle($);
  if (!title) return null;
  const match = title.match(/(\d{4})\s/);
  return match ? match[1] : null;
}

function extractSet($) {
  // Usually in format: YEAR BRAND SET #NUM
  // e.g., "2023 TOPPS CHROME #1"
  const title = extractCardTitle($);
  if (!title) return null;
  const parts = title.split('#');
  if (parts[0]) {
    const setPart = parts[0].trim().split(/\s+/).slice(1, -1).join(' ');
    return setPart || null;
  }
  return null;
}

function extractCardNumber($) {
  const title = extractCardTitle($);
  if (!title) return null;
  const match = title.match(/#(\d+)/);
  return match ? match[1] : null;
}

function extractGrade($) {
  // Look for grade in format "MINT 9" or similar
  // Try multiple selectors
  let gradeText = $('[data-grade], .grade, .item-grade').first().text().trim();
  if (!gradeText) {
    gradeText = $('*:contains("MINT")').first().text().trim();
  }
  const match = gradeText.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function extractGradeCategory($) {
  // e.g., "MINT", "GEM MINT", "EXCELLENT", etc.
  let gradeText = $('[data-grade], .grade, .item-grade').first().text().trim();
  if (!gradeText) {
    gradeText = $('*:contains("MINT")').first().text().trim();
  }
  const match = gradeText.match(/^([A-Z\s]+)\s+\d/);
  return match ? match[1].trim() : null;
}

function extractPSAEstimate($) {
  // Look for price estimate
  let estimateText = $('[data-estimate], .psa-estimate, .estimate-price').first().text();
  if (!estimateText) {
    estimateText = $('*:contains("PSA Estimate")').next().text();
  }
  const match = estimateText.match(/\$[\d,]+(?:\.\d{2})?/);
  if (match) {
    const priceStr = match[0].replace(/[$,]/g, '');
    return parseFloat(priceStr);
  }
  return null;
}

function extractPopulation($) {
  // PSA Population at this grade
  let popText = $('[data-population], .population').first().text();
  if (!popText) {
    popText = $('*:contains("PSA Population")').next().text();
  }
  const match = popText.match(/[\d,]+/);
  if (match) {
    return parseInt(match[0].replace(/,/g, ''), 10);
  }
  return null;
}

function extractPopHigher($) {
  // PSA Pop Higher (graded higher)
  let popHigherText = $('[data-pop-higher], .pop-higher').first().text();
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
  const frontImg = $('[data-front-image], .card-front-image, img[alt*="front"]').first();
  return frontImg.attr('src') || frontImg.attr('data-src') || null;
}

function extractBackImage($) {
  // Back image of the card
  const backImg = $('[data-back-image], .card-back-image, img[alt*="back"]').first();
  return backImg.attr('src') || backImg.attr('data-src') || null;
}

function extractVariant($) {
  // Card variant info (parallel, autograph, etc.)
  let variantText = $('.variant, [data-variant]').first().text().trim();
  return variantText || null;
}

function extractCondition($) {
  // Detailed condition notes
  let conditionText = $('.condition, [data-condition]').first().text().trim();
  return conditionText || null;
}

export { fetchPSACertification };
