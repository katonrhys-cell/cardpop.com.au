import { supabase } from '../utils/supabaseClient.js';
import { psaApiClient } from '../utils/psaApiClient.js';
import logger from '../utils/logger.js';

const CACHE_VALIDITY_DAYS = 90;
const CACHE_EXPIRY_MS = CACHE_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

export async function verifyGradingNumber({ gradingNumber, company = 'psa' }) {
  if (!gradingNumber || typeof gradingNumber !== 'string') {
    throw new Error('gradingNumber is required');
  }

  if (company !== 'psa' && company !== 'beckett') {
    throw new Error('company must be either "psa" or "beckett"');
  }

  const normalizedNumber = gradingNumber.trim();

  try {
    // Check cache first
    const cached = await getFromCache(normalizedNumber, company);
    if (cached && isCacheValid(cached)) {
      logger.info(`[GRADING_VERIFICATION] Cache hit for ${normalizedNumber}`);
      return {
        verified: cached.verified,
        company,
        details: cached.details,
        cached: true,
        cachedAt: cached.verified_at
      };
    }

    logger.info(`[GRADING_VERIFICATION] No valid cache, querying ${company.toUpperCase()} API for ${normalizedNumber}`);

    // Query external API
    let details;
    if (company === 'psa') {
      details = await psaApiClient.lookupCard({ gradingNumber: normalizedNumber });
    } else if (company === 'beckett') {
      // Placeholder for Beckett implementation
      throw new Error('Beckett verification not yet implemented');
    }

    const verified = !!details;

    // Save to cache
    await saveToCache(normalizedNumber, company, verified, details);

    return {
      verified,
      company,
      details: details || null,
      cached: false
    };
  } catch (error) {
    logger.error(`[GRADING_VERIFICATION] Error verifying ${normalizedNumber}: ${error.message}`);
    throw error;
  }
}

/**
 * Read a verification result from the cache only — never queries the external
 * API. Returns the same shape as verifyGradingNumber when a valid cache entry
 * exists, or null when there is no (valid) cached result.
 */
export async function getCachedVerification({ gradingNumber, company = 'psa' }) {
  if (!gradingNumber || typeof gradingNumber !== 'string') {
    throw new Error('gradingNumber is required');
  }
  if (company !== 'psa' && company !== 'beckett') {
    throw new Error('company must be either "psa" or "beckett"');
  }

  const cached = await getFromCache(gradingNumber.trim(), company);
  if (!cached || !isCacheValid(cached)) return null;

  return {
    verified: cached.verified,
    company,
    details: cached.details,
    cached: true,
    cachedAt: cached.verified_at,
  };
}

async function getFromCache(gradingNumber, company) {
  try {
    const { data, error } = await supabase
      .from('grading_verifications')
      .select('*')
      .eq('grading_number', gradingNumber)
      .eq('company', company)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows, which is fine
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(`[GRADING_VERIFICATION] Cache fetch error: ${error.message}`);
    return null;
  }
}

function isCacheValid(cacheEntry) {
  if (!cacheEntry.expires_at) {
    return true;
  }
  const expiryTime = new Date(cacheEntry.expires_at).getTime();
  const now = Date.now();
  return now < expiryTime;
}

async function saveToCache(gradingNumber, company, verified, details) {
  try {
    const expiresAt = new Date(Date.now() + CACHE_EXPIRY_MS).toISOString();

    const { error } = await supabase
      .from('grading_verifications')
      .upsert({
        grading_number: gradingNumber,
        company,
        verified,
        details: details || null,
        verified_at: new Date().toISOString(),
        expires_at: expiresAt
      }, {
        onConflict: 'grading_number,company'
      });

    if (error) {
      logger.error(`[GRADING_VERIFICATION] Cache save error: ${error.message}`);
    } else {
      logger.info(`[GRADING_VERIFICATION] Cached verification for ${gradingNumber}`);
    }
  } catch (error) {
    logger.error(`[GRADING_VERIFICATION] Cache save failed: ${error.message}`);
  }
}
