import 'dotenv/config';
import logger from './logger.js';

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const EBAY_SANDBOX_URL = process.env.EBAY_SANDBOX_URL || 'https://api.sandbox.ebay.com';

if (!EBAY_APP_ID || !EBAY_CLIENT_SECRET) {
  logger.warn('[EBAY_CLIENT] Missing eBay API credentials: EBAY_APP_ID or EBAY_CLIENT_SECRET not configured');
}

let accessToken = null;
let tokenExpiry = null;

/**
 * Get OAuth2 access token from eBay
 * Caches token and refreshes when expired
 * @returns {Promise<string>} OAuth2 access token
 */
async function getAccessToken() {
  const now = Date.now();
  
  // Return cached token if still valid (with 60s buffer)
  if (accessToken && tokenExpiry && now < tokenExpiry - 60000) {
    logger.debug('[EBAY_CLIENT] Using cached access token');
    return accessToken;
  }

  if (!EBAY_APP_ID || !EBAY_CLIENT_SECRET) {
    throw new Error('eBay API credentials not configured: EBAY_APP_ID and EBAY_CLIENT_SECRET required');
  }

  logger.info('[EBAY_CLIENT] Requesting new OAuth2 access token');
  const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${EBAY_SANDBOX_URL}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[EBAY_CLIENT] OAuth2 token request failed: ${response.status} ${response.statusText}`);
    logger.error(`[EBAY_CLIENT] Error details: ${errorText}`);
    throw new Error(`eBay OAuth2 failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = now + (data.expires_in * 1000);
  
  logger.info(`[EBAY_CLIENT] New access token obtained, expires in ${data.expires_in}s`);
  return accessToken;
}

/**
 * Call eBay API endpoint with OAuth2 authentication
 * @param {string} endpoint - API endpoint path (e.g., '/buy/browse/v1/item_summary/search')
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Object>} API response JSON
 */
async function callEbayApi(endpoint, options = {}) {
  try {
    const token = await getAccessToken();
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const url = `${EBAY_SANDBOX_URL}${endpoint}`;
    logger.debug(`[EBAY_CLIENT] Calling eBay API: ${options.method || 'GET'} ${endpoint}`);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[EBAY_CLIENT] API call failed: ${response.status} ${response.statusText}`);
      logger.error(`[EBAY_CLIENT] Error details: ${errorText}`);
      
      let errorMessage = `eBay API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.errors && errorData.errors.length > 0) {
          errorMessage = errorData.errors[0].message || errorMessage;
        }
      } catch (e) {
        // Continue with generic error message
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    logger.debug(`[EBAY_CLIENT] API call successful: ${endpoint}`);
    return data;
  } catch (error) {
    logger.error(`[EBAY_CLIENT] Error calling eBay API: ${error.message}`);
    throw error;
  }
}

export { getAccessToken, callEbayApi };
