import logger from './logger.js';

const PSA_API_BASE = 'https://api.psacard.com/publicapi';
const PSA_API_TOKEN = process.env.PSA_API_TOKEN;

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

    try {
      logger.info(`[PSA_API] Looking up cert: ${cert}`);

      const response = await fetch(
        `${PSA_API_BASE}/cert/GetByCertNumber/${encodeURIComponent(cert)}`,
        {
          method: 'GET',
          headers: {
            'authorization': `bearer ${PSA_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 404) {
        logger.info(`[PSA_API] Cert not found: ${gradingNumber}`);
        return null;
      }

      if (!response.ok) {
        throw new Error(`PSA API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      logger.info(`[PSA_API] Successfully retrieved cert ${cert}`);
      return result;
    } catch (error) {
      logger.error(`[PSA_API] Lookup failed for ${gradingNumber}: ${error.message}`);
      throw error;
    }
  }
};

export default psaApiClient;
