import { supabase } from '../utils/supabaseClient.js';
import { psaApiClient } from '../utils/psaApiClient.js';
import logger from '../utils/logger.js';

const CACHE_VALIDITY_DAYS = 90;
const CACHE_EXPIRY_MS = CACHE_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

// Pull the graded value out of a grading-company cert payload, tolerant of the
// various shapes PSA returns it in.
export function extractVerifiedGrade(details) {
  if (!details || typeof details !== 'object') return null;
  const cert = details.PSACert || details.psaCert || details;
  return (
    cert.CardGrade ?? cert.cardGrade ?? cert.grade ??
    cert.GradeDescription ?? cert.gradeDescription ?? null
  );
}

// Reduce a grade label to its numeric value: "PSA 10" → 10, "GEM-MT 10" → 10,
// "9.5" → 9.5. Non-numeric grades (e.g. "Authentic") → null.
export function parseGradeValue(grade) {
  if (grade == null) return null;
  const m = String(grade).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

// Does the seller's claimed grade match the verified cert's grade?
//   true  — both numeric and equal
//   false — both numeric and different (the scam case: real cert, inflated claim)
//   null  — nothing to compare (no claim, or a non-numeric grade)
export function computeGradeMatch(details, expectedGrade) {
  if (expectedGrade == null || String(expectedGrade).trim() === '') return null;
  const certNum = parseGradeValue(extractVerifiedGrade(details));
  const claimNum = parseGradeValue(expectedGrade);
  if (certNum == null || claimNum == null) return null;
  return certNum === claimNum;
}

export async function verifyGradingNumber({ gradingNumber, company = 'psa', expectedGrade = null }) {
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
        verifiedGrade: extractVerifiedGrade(cached.details),
        gradeMatch: computeGradeMatch(cached.details, expectedGrade),
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
      verifiedGrade: extractVerifiedGrade(details),
      gradeMatch: computeGradeMatch(details, expectedGrade),
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
