import logger from './logger.js';
import { OUTBOUND_TIMEOUT_MS } from './outboundTimeouts.js';

const PSA_API_BASE = 'https://api.psacard.com/publicapi';
const PSA_API_TOKEN = process.env.PSA_API_TOKEN;

// Transient failures (network drops, PSA 5xx, rate limits) are retried with
// exponential backoff; definitive answers (404 not-found, auth/4xx) are not —
// retrying those just adds latency without changing the outcome.
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const psaApiClient = {
  async lookupCard({ gradingNumber }) {
    if (!PSA_API_TOKEN) {
      throw new Error('PSA_API_TOKEN environment variable is not set');
    }

    if (!gradingNumber || typeof gradingNumber !== 'string') {
      throw new Error('gradingNumber is required and must be a string');
    }

    // PSA cert numbers are alphanumeric; reject anything else so the value can't
    // be used to alter the request path/query (path injection / request forgery).
    const cert = gradingNumber.trim();
    if (!/^[A-Za-z0-9-]+$/.test(cert)) {
      throw new Error('Invalid grading number format');
    }

    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        logger.info(`[PSA_API] Looking up cert: ${cert} (attempt ${attempt}/${MAX_ATTEMPTS})`);

        const response = await fetch(
          `${PSA_API_BASE}/cert/GetByCertNumber/${encodeURIComponent(cert)}`,
          {
            method: 'GET',
            headers: {
              'authorization': `bearer ${PSA_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.psa),
          }
        );

        // A clean "not found" is a definitive answer — never retry it.
        if (response.status === 404) {
          logger.info(`[PSA_API] Cert not found: ${cert}`);
          return null;
        }

        // Server errors and rate limits are worth retrying.
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`PSA API error: ${response.status} ${response.statusText}`);
        }

        // Any other non-OK status (e.g. 401/403 auth) is a definitive client
        // error — surface it immediately rather than burning retries.
        if (!response.ok) {
          throw Object.assign(
            new Error(`PSA API error: ${response.status} ${response.statusText}`),
            { fatal: true }
          );
        }

        const result = await response.json();
        logger.info(`[PSA_API] Successfully retrieved cert ${cert}`);
        return result;
      } catch (error) {
        lastError = error;
        if (error.fatal || attempt === MAX_ATTEMPTS) break;
        const backoff = RETRY_BASE_MS * 2 ** (attempt - 1);
        logger.warn(`[PSA_API] Attempt ${attempt}/${MAX_ATTEMPTS} failed for ${cert}: ${error.message}; retrying in ${backoff}ms`);
        await sleep(backoff);
      }
    }

    logger.error(`[PSA_API] Lookup failed for ${cert}: ${lastError.message}`);
    throw lastError;
  },

  // Card images live on a separate PSA endpoint from the cert record. Images are
  // purely decorative here, so this is best-effort: any failure resolves to an
  // empty list rather than throwing, so it can never downgrade a cert lookup
  // that otherwise succeeded.
  async lookupImages({ gradingNumber }) {
    if (!PSA_API_TOKEN) return [];
    if (!gradingNumber || typeof gradingNumber !== 'string') return [];

    const cert = gradingNumber.trim();
    if (!/^[A-Za-z0-9-]+$/.test(cert)) return [];

    try {
      const response = await fetch(
        `${PSA_API_BASE}/cert/GetImagesByCertNumber/${encodeURIComponent(cert)}`,
        {
          method: 'GET',
          headers: {
            'authorization': `bearer ${PSA_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.psa),
        }
      );

      if (!response.ok) {
        logger.warn(`[PSA_API] Image lookup for ${cert} returned ${response.status}`);
        return [];
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      logger.warn(`[PSA_API] Image lookup failed for ${cert}: ${error.message}`);
      return [];
    }
  }
};

export default psaApiClient;
