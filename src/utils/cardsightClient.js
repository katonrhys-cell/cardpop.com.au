import 'dotenv/config';
import logger from './logger.js';

const CARDSIGHT_API_KEY = process.env.CARDSIGHT_API_KEY;
const CARDSIGHT_BASE_URL = 'https://api.cardsight.ai';

if (!CARDSIGHT_API_KEY) {
  logger.warn('[CARDSIGHT] CARDSIGHT_API_KEY not configured — card identification and pricing will be unavailable');
}

async function callCardsight(endpoint, options = {}) {
  if (!CARDSIGHT_API_KEY) {
    throw new Error('CardSight API not configured: set CARDSIGHT_API_KEY');
  }

  const isFormData = options.body instanceof FormData;

  const headers = {
    'X-API-Key': CARDSIGHT_API_KEY,
    ...options.headers,
  };

  // Let fetch set Content-Type (with multipart boundary) for FormData; set JSON otherwise
  if (!isFormData && options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${CARDSIGHT_BASE_URL}${endpoint}`;
  logger.debug(`[CARDSIGHT] ${options.method || 'GET'} ${endpoint}`);

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const text = await response.text();
    logger.error(`[CARDSIGHT] Error ${response.status} on ${endpoint}: ${text}`);
    let message = `CardSight API error: ${response.status}`;
    try {
      const err = JSON.parse(text);
      if (err.message) message = err.message;
    } catch {}
    throw new Error(message);
  }

  return response.json();
}

export { callCardsight };
