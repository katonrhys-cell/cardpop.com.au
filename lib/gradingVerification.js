// Frontend utility for grading verification API calls

const API_BASE = '/hcgi/api/grading-verification';

export async function verifyGradingNumber(gradingNumber, company = 'psa') {
  if (!gradingNumber || !gradingNumber.trim()) {
    throw new Error('gradingNumber is required');
  }

  const response = await fetch(`${API_BASE}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      gradingNumber: gradingNumber.trim(),
      company
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Verification failed: ${response.status}`);
  }

  return response.json();
}

export async function getCachedVerification(gradingNumber, company = 'psa') {
  if (!gradingNumber || !gradingNumber.trim()) {
    throw new Error('gradingNumber is required');
  }

  const response = await fetch(
    `${API_BASE}/${encodeURIComponent(gradingNumber.trim())}?company=${company}`,
    { method: 'GET' }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Fetch failed: ${response.status}`);
  }

  return response.json();
}

export function formatVerificationResult(result) {
  if (!result) {
    return {
      verified: false,
      status: 'Not verified',
      company: null,
      details: null
    };
  }

  return {
    verified: result.verified,
    status: result.verified ? 'Verified' : 'Not found',
    company: result.company,
    details: result.details,
    cached: result.cached,
    cachedAt: result.cachedAt
  };
}
