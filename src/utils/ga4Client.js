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
// The same service account also reads Search Console (clicks / impressions)
// for the home page — src/utils/searchConsoleClient.js asks for a token with
// this scope through getAccessToken({ scope }).
export const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 15_000;

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Escape line breaks that sit inside JSON string literals, leaving the rest. */
const escapeBreaksInStrings = (text) => {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString && ch === '\\') { out += ch + (text[i + 1] ?? ''); i += 1; continue; }
    if (ch === '"') inString = !inString;
    if (inString && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      out += '\\n';
      continue;
    }
    out += ch;
  }
  return out;
};

/**
 * The text forms a pasted key commonly arrives in, most likely first: as-is;
 * with a BOM or wrapping quotes stripped (a value copied from a .env line);
 * base64 (whitespace and line breaks ignored); and with real line breaks
 * turned back into `\n` escapes (a private key whose escapes were expanded
 * on the way into the dashboard is otherwise invalid JSON).
 */
const serviceAccountCandidates = (raw) => {
  const original = String(raw).replace(/^\uFEFF/, '').trim();
  const quoted = /^(['"]).*\1$/s.test(original);
  const text = quoted ? original.slice(1, -1).trim() : original;
  const forms = quoted ? [original, text] : [text];
  if (!text.startsWith('{')) {
    try { forms.push(Buffer.from(text.replace(/\s+/g, ''), 'base64').toString('utf8').trim()); } catch { /* not base64 */ }
  }
  // Typographic quotes, non-breaking spaces and zero-width characters, which
  // a notes app or "smart punctuation" swaps in; none can appear in a real key.
  for (const form of [...forms]) {
    const plain = normaliseTypography(form);
    if (plain !== form) forms.push(plain);
  }
  const out = [];
  for (const form of forms) {
    out.push(form);
    if (/[\r\n]/.test(form)) out.push(escapeBreaksInStrings(form));
  }
  return out;
};

const normaliseTypography = (text) => text
  .replace(/[\u201C\u201D\u201E\u201F\u2033\uFF02]/g, '"')
  .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
  .replace(/[\u00A0\u2007\u202F]/g, ' ')
  .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');

/**
 * Where JSON.parse gives up on the value, described without echoing it: the
 * character position and, only when it is punctuation or whitespace (never a
 * letter or digit, which could be part of the key), which character it is.
 */
const describeParseFailure = (text) => {
  try {
    JSON.parse(text);
    return '';
  } catch (err) {
    const match = /position (\d+)/.exec(err.message || '');
    if (!match) return ' JSON.parse stopped before the end of the value.';
    const pos = Number(match[1]);
    const ch = text[pos];
    const safe = ch && !/[A-Za-z0-9+/=_-]/.test(ch);
    const what = safe
      ? ` (${JSON.stringify(ch)}, U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`
      : '';
    return ` It stops parsing at character ${pos + 1} of ${text.length}${what}.`;
  }
};

const parseCandidate = (candidate) => {
  try {
    let parsed = JSON.parse(candidate);
    // A key JSON-encoded twice (a string holding the JSON) parses to a string.
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isServiceAccountKey = (o) => Boolean(o && typeof o.client_email === 'string' && typeof o.private_key === 'string');

/** Parse GA4_SERVICE_ACCOUNT_JSON (raw JSON or base64). Returns null if unusable. */
export const parseServiceAccount = (raw = process.env.GA4_SERVICE_ACCOUNT_JSON) => {
  if (!raw || !String(raw).trim()) return null;
  for (const candidate of serviceAccountCandidates(raw)) {
    const parsed = parseCandidate(candidate);
    if (isServiceAccountKey(parsed)) {
      return { clientEmail: parsed.client_email, privateKey: parsed.private_key.replace(/\\n/g, '\n') };
    }
  }
  return null;
};

/**
 * Why GA4_SERVICE_ACCOUNT_JSON is unusable, in words an admin can act on, or
 * null when it parses. Never echoes the value — only its length and, for a
 * JSON object of the wrong kind, its top-level key names.
 */
export const describeServiceAccountProblem = (raw = process.env.GA4_SERVICE_ACCOUNT_JSON) => {
  if (!raw || !String(raw).trim()) return 'GA4_SERVICE_ACCOUNT_JSON is not set in this deployment';
  if (parseServiceAccount(raw)) return null;
  const length = String(raw).trim().length;
  const objects = serviceAccountCandidates(raw).map(parseCandidate).filter(Boolean);
  if (objects.length) {
    const keys = Object.keys(objects[0]).slice(0, 8).join(', ') || 'none';
    const hint = objects[0].web || objects[0].installed
      ? ' — that is an OAuth client, not a service-account key'
      : '';
    return `GA4_SERVICE_ACCOUNT_JSON is JSON but not a service-account key (it has: ${keys})${hint}. `
      + 'Download a key from IAM & Admin → Service Accounts → Keys → Add key → JSON';
  }
  const text = String(raw).replace(/^\uFEFF/, '').trim();
  const where = text.startsWith('{') ? describeParseFailure(text) : '';
  const cause = length < 2000
    ? 'it looks cut short (a full key is about 2,300 characters)'
    : 'its length looks right, so something in it was altered when pasted';
  return `GA4_SERVICE_ACCOUNT_JSON is set (${length} characters) but isn't valid JSON or base64 JSON — `
    + `${cause}.${where} Paste the whole downloaded file again, or its base64`;
};

/** Why GA4_PROPERTY_ID is unusable, or null when it is a numeric id. */
export const describePropertyIdProblem = (raw = process.env.GA4_PROPERTY_ID) => {
  const id = String(raw || '').trim();
  if (!id) return 'GA4_PROPERTY_ID is not set in this deployment';
  if (getPropertyId(id)) return null;
  if (/^G-/i.test(id)) {
    return 'GA4_PROPERTY_ID is a G-… measurement id; it needs the numeric Property ID '
      + '(GA4 → Admin → Property settings)';
  }
  return 'GA4_PROPERTY_ID must be the numeric Property ID (GA4 → Admin → Property settings)';
};

/** Numeric GA4 property id from GA4_PROPERTY_ID ("123456" or "properties/123456"). */
export const getPropertyId = (raw = process.env.GA4_PROPERTY_ID) => {
  const id = String(raw || '').trim().replace(/^properties\//, '');
  return /^\d+$/.test(id) ? id : null;
};

export const isGa4Configured = () => Boolean(getPropertyId() && parseServiceAccount());

/** Build and sign the service-account assertion (RS256). Exported for tests. */
export const buildAssertion = ({ clientEmail, privateKey }, { now = Date.now(), ttlSeconds = 3600, scope = SCOPE } = {}) => {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: clientEmail,
    scope,
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

// One access token per scope per process, reused until a minute before it
// expires (a token is minted for one scope, so Search Console reads can't
// share the Analytics one).
const cachedTokens = new Map();

export const _resetTokenCache = () => { cachedTokens.clear(); };

export const getAccessToken = async ({ scope = SCOPE } = {}) => {
  const cached = cachedTokens.get(scope);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
  const account = parseServiceAccount();
  if (!account) throw new Error('GA4_SERVICE_ACCOUNT_JSON is not set or not a service-account key');

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: buildAssertion(account, { scope }),
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
  cachedTokens.set(scope, { token: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 });
  return json.access_token;
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
    if (res.status === 401) cachedTokens.delete(SCOPE);
    logger.warn(`[GA4] runReport failed (${res.status}): ${text}`);
    throw new Error(`GA4 runReport failed (${res.status})`);
  }
  return res.json();
};
