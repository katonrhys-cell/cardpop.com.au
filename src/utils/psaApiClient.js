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

    try {
      logger.info(`[PSA_API] Looking up cert: ${gradingNumber}`);

      const response = await fetch(
        `${PSA_API_BASE}/cert/GetByCertNumber/${gradingNumber.trim()}`,
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

      const cert = await response.json();
      logger.info(`[PSA_API] Successfully retrieved cert ${gradingNumber}`);
      return cert;
    } catch (error) {
      logger.error(`[PSA_API] Lookup failed for ${gradingNumber}: ${error.message}`);
      throw error;
    }
  }
};

export default psaApiClient;
