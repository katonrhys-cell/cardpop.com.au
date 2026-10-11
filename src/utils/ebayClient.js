import 'dotenv/config';
import logger from './logger.js';
import { OUTBOUND_TIMEOUT_MS } from './outboundTimeouts.js';

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
// Default to production — set EBAY_API_URL=https://api.sandbox.ebay.com in .env for sandbox testing
const EBAY_API_URL = process.env.EBAY_API_URL || 'https://api.ebay.com';
const EBAY_MARKETPLACE_ID = process.env.EBAY_MARKETPLACE_ID || 'EBAY_AU';

if (!EBAY_APP_ID || !EBAY_CLIENT_SECRET) {
  logger.warn('[EBAY_CLIENT] Missing eBay API credentials: EBAY_APP_ID or EBAY_CLIENT_SECRET not configured');
}

let accessToken = null;
let tokenExpiry = null;
// The token request in flight, so concurrent callers share one. A cold
// /ebay/popular-cards fans out sixteen searches at once; before this each saw
// an empty cache and requested its own token — sixteen OAuth round trips for
// one token.
let tokenRequest = null;

async function requestAccessToken() {
  const now = Date.now();
  logger.info('[EBAY_CLIENT] Requesting new OAuth2 access token');
  const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(`${EBAY_API_URL}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.ebay),
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

async function getAccessToken() {
  const now = Date.now();

  if (accessToken && tokenExpiry && now < tokenExpiry - 60000) {
    logger.debug('[EBAY_CLIENT] Using cached access token');
    return accessToken;
  }

  if (!EBAY_APP_ID || !EBAY_CLIENT_SECRET) {
    throw new Error('eBay API credentials not configured: EBAY_APP_ID and EBAY_CLIENT_SECRET required');
  }

  if (!tokenRequest) {
    tokenRequest = requestAccessToken().finally(() => { tokenRequest = null; });
  }
  return tokenRequest;
}

async function callEbayApi(endpoint, options = {}) {
  try {
    const token = await getAccessToken();

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Required for AU-localised results and currency
      'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE_ID,
      ...options.headers,
    };

    const url = `${EBAY_API_URL}${endpoint}`;
    logger.debug(`[EBAY_CLIENT] Calling eBay API: ${options.method || 'GET'} ${endpoint}`);

    // A caller may pass its own signal (e.g. a cron's overall deadline); the
    // per-call timeout still applies alongside it.
    const signal = options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.ebay)])
      : AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.ebay);
    const response = await fetch(url, { ...options, headers, signal });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[EBAY_CLIENT] API call failed: ${response.status} ${response.statusText}`);
      logger.error(`[EBAY_CLIENT] Error details: ${errorText}`);

      let errorMessage = `eBay API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.errors?.length > 0) {
          errorMessage = errorData.errors[0].message || errorMessage;
        }
      } catch {
        // use generic message
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
