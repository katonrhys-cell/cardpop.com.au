import { supabase } from '../utils/supabaseClient.js';
import { psaApiClient } from '../utils/psaApiClient.js';
import logger from '../utils/logger.js';

// A verified cert is immutable — its grade never changes — so a positive result
// is cached for a long time. A "not found" is provisional (the cert may be newly
// issued, or the miss may have been a transient upstream hiccup), so it expires
// quickly and gets re-checked sooner.
const POSITIVE_CACHE_DAYS = 90;
const NEGATIVE_CACHE_DAYS = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

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

  // Read the cache once up front. A fresh entry is the fast path; a stale entry
  // becomes a fallback if the live lookup fails below.
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
      stale: false,
      cachedAt: cached.verified_at
    };
  }

  logger.info(`[GRADING_VERIFICATION] No valid cache, querying ${company.toUpperCase()} API for ${normalizedNumber}`);

  try {
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
      cached: false,
      stale: false
    };
  } catch (error) {
    // The live lookup failed. If we have ANY prior cached result — even an
    // expired one — serve it rather than surfacing a verification error to the
    // buyer: a PSA cert is immutable, so a past successful verification is still
    // trustworthy during a transient PSA outage. (Beckett-not-implemented is a
    // config gap, not an outage, so it must not be masked by a stale row.)
    if (cached && !/not yet implemented/i.test(error.message)) {
      logger.warn(`[GRADING_VERIFICATION] Live lookup failed for ${normalizedNumber} (${error.message}); serving stale cache from ${cached.verified_at}`);
      return {
        verified: cached.verified,
        company,
        details: cached.details,
        verifiedGrade: extractVerifiedGrade(cached.details),
        gradeMatch: computeGradeMatch(cached.details, expectedGrade),
        cached: true,
        stale: true,
        cachedAt: cached.verified_at
      };
    }
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
    const cacheDays = verified ? POSITIVE_CACHE_DAYS : NEGATIVE_CACHE_DAYS;
    const expiresAt = new Date(Date.now() + cacheDays * DAY_MS).toISOString();

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
