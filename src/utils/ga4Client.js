/**
 * Google Analytics 4 Data API client (service account).
 *
 * Dependency-free on purpose: the `googleapis` package is tens of megabytes
 * and this is the only Google API the backend talks to. A service-account
 * JWT is signed with Node's crypto, swapped for an access token at Google's
 * OAuth endpoint, and `runReport` is a single JSON POST.
 *
 * Configuration (both required, else `isGa4Configured()` is false and callers
 * skip — the site must keep working with analytics unconfigured):
 *   GA4_PROPERTY_ID          numeric property id (Admin → Property settings),
 *                            "properties/123" is accepted too.
 *   GA4_SERVICE_ACCOUNT_JSON the service account's key file, as raw JSON or
 *                            base64-encoded JSON. The account needs Viewer
 *                            access on the GA4 property.
 *
 * Runbook: docs/site-traffic.md.
 */
import crypto from 'node:crypto';
import logger from './logger.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 15_000;

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Parse GA4_SERVICE_ACCOUNT_JSON (raw JSON or base64). Returns null if unusable. */
export const parseServiceAccount = (raw = process.env.GA4_SERVICE_ACCOUNT_JSON) => {
  if (!raw || !String(raw).trim()) return null;
  const text = String(raw).trim();
  const candidates = [text];
  if (!text.startsWith('{')) {
    try { candidates.push(Buffer.from(text, 'base64').toString('utf8')); } catch { /* not base64 */ }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed.client_email === 'string' && typeof parsed.private_key === 'string') {
        return { clientEmail: parsed.client_email, privateKey: parsed.private_key.replace(/\\n/g, '\n') };
      }
    } catch { /* try the next form */ }
  }
  return null;
};

/** Numeric GA4 property id from GA4_PROPERTY_ID ("123456" or "properties/123456"). */
export const getPropertyId = (raw = process.env.GA4_PROPERTY_ID) => {
  const id = String(raw || '').trim().replace(/^properties\//, '');
  return /^\d+$/.test(id) ? id : null;
};

export const isGa4Configured = () => Boolean(getPropertyId() && parseServiceAccount());

/** Build and sign the service-account assertion (RS256). Exported for tests. */
export const buildAssertion = ({ clientEmail, privateKey }, { now = Date.now(), ttlSeconds = 3600 } = {}) => {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat,
    exp: iat + ttlSeconds,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey);
  return `${unsigned}.${b64url(signature)}`;
};

const fetchWithTimeout = async (url, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

// One access token per process, reused until a minute before it expires.
let cachedToken = null;

export const _resetTokenCache = () => { cachedToken = null; };

export const getAccessToken = async () => {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token;
  const account = parseServiceAccount();
  if (!account) throw new Error('GA4_SERVICE_ACCOUNT_JSON is not set or not a service-account key');

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: buildAssertion(account),
  });
  const res = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`GA4 token exchange failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error('GA4 token exchange returned no access_token');
  cachedToken = { token: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
  return cachedToken.token;
};

/**
 * Run a GA4 Data API report. `request` is the runReport body
 * (dateRanges, dimensions, metrics, metricAggregations, …) — see
 * https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
 * Returns the raw response ({ rows, totals, rowCount, … }).
 */
export const runGa4Report = async (request) => {
  const propertyId = getPropertyId();
  if (!propertyId) throw new Error('GA4_PROPERTY_ID is not set');
  const token = await getAccessToken();
  const res = await fetchWithTimeout(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 500);
    if (res.status === 401) cachedToken = null;
    logger.warn(`[GA4] runReport failed (${res.status}): ${text}`);
    throw new Error(`GA4 runReport failed (${res.status})`);
  }
  return res.json();
};
