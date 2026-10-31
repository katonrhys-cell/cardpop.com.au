/**
 * Google Search Console (Search Analytics API) client — service account.
 *
 * Feeds the home page's "Found on Google" tiles (clicks and impressions) and
 * the admin Visitors card. Same shape as ga4Client.js and deliberately
 * dependency-free: the service account in GA4_SERVICE_ACCOUNT_JSON signs a
 * JWT for the webmasters.readonly scope (ga4Client's getAccessToken caches a
 * token per scope) and the report is one JSON POST.
 *
 * Configuration (both needed, else `isSearchConsoleConfigured()` is false and
 * the sync skips Search Console — GA4 keeps working on its own):
 *   GSC_SITE_URL              the property exactly as Search Console names it:
 *                             "sc-domain:cardpop.com.au" for a Domain property
 *                             or "https://cardpop.com.au/" for a URL-prefix one.
 *   GA4_SERVICE_ACCOUNT_JSON  shared with GA4. The account must be added to the
 *                             Search Console property as a (restricted) user.
 *
 * Runbook: docs/site-traffic.md → Search Console.
 */
import { getAccessToken, parseServiceAccount, SEARCH_CONSOLE_SCOPE } from './ga4Client.js';
import { OUTBOUND_TIMEOUT_MS } from './outboundTimeouts.js';
import logger from './logger.js';

const API = 'https://www.googleapis.com/webmasters/v3/sites';

/** Trimmed GSC_SITE_URL, or null when unset / not a property name. */
export const getSiteUrl = (raw = process.env.GSC_SITE_URL) => {
  const url = String(raw || '').trim();
  if (/^sc-domain:[a-z0-9.-]+$/i.test(url)) return url;
  if (/^https?:\/\/[^\s]+$/i.test(url)) return url.endsWith('/') ? url : `${url}/`;
  return null;
};

export const isSearchConsoleConfigured = () => Boolean(getSiteUrl() && parseServiceAccount());

/**
 * Run a Search Analytics query. `request` is the searchAnalytics.query body
 * (startDate, endDate, dimensions, rowLimit, dataState, …) — see
 * https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 * Returns the raw response ({ rows: [{ keys, clicks, impressions, ctr, position }] }).
 */
export const runSearchAnalytics = async (request) => {
  const siteUrl = getSiteUrl();
  if (!siteUrl) throw new Error('GSC_SITE_URL is not set');
  const token = await getAccessToken({ scope: SEARCH_CONSOLE_SCOPE });
  const res = await fetch(`${API}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.searchConsole),
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 500);
    logger.warn(`[SEARCH_CONSOLE] searchAnalytics.query failed (${res.status}): ${text}`);
    throw new Error(`Search Console query failed (${res.status})`);
  }
  return res.json();
};
