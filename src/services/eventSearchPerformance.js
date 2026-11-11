import { createTtlCache } from '../utils/ttlCache.js';
import { runSearchAnalytics } from '../utils/searchConsoleClient.js';

// Google search performance of ONE event page, from Search Console — what an
// organiser sees under Account → My Events → Search. docs/event-views.md.
//
// Search Console's data lags ~2 days, so the window is the 28 days ending two
// days ago. Results are cached per page for a few hours (EVENT_SEARCH_CACHE_TTL_MS)
// so organisers opening the panel repeatedly don't each cost a Search Console call.

// Google reports the canonical origin, whatever host the request came through.
const SITE_URL = 'https://cardpop.com.au';
export const WINDOW_DAYS = 28;
const LAG_DAYS = 2;
const TOP_QUERIES = 10;

const cache = createTtlCache({ ttlMs: () => process.env.EVENT_SEARCH_CACHE_TTL_MS ?? 6 * 60 * 60 * 1000, maxEntries: 500 });

const ymd = (d) => d.toISOString().slice(0, 10);

/** { startDate, endDate } — the 28 days ending LAG_DAYS before `now`. */
export function searchWindow(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - LAG_DAYS));
  const start = new Date(end.getTime() - (WINDOW_DAYS - 1) * 86_400_000);
  return { startDate: ymd(start), endDate: ymd(end) };
}

/** The canonical page URL Google reports for an event. */
export const eventPageUrl = (event) => `${SITE_URL}/events/${event.slug || event.id}`;

const pageFilter = (url) => ({
  dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: url }] }],
});

const round = (n, places) => {
  const f = 10 ** places;
  return Math.round((Number(n) || 0) * f) / f;
};

/**
 * @returns {Promise<{ pageUrl, startDate, endDate, clicks, impressions, ctr, position, queries: Array<{query, clicks, impressions, position}> }>}
 * `position` is null when the page had no impressions.
 */
export function getEventSearchPerformance(event, now = new Date()) {
  const pageUrl = eventPageUrl(event);
  const { startDate, endDate } = searchWindow(now);
  return cache.get(`${pageUrl}|${endDate}`, async () => {
    const base = { startDate, endDate, ...pageFilter(pageUrl) };
    const [totals, byQuery] = await Promise.all([
      runSearchAnalytics({ ...base }),
      runSearchAnalytics({ ...base, dimensions: ['query'], rowLimit: TOP_QUERIES }),
    ]);
    const t = totals?.rows?.[0];
    return {
      pageUrl,
      startDate,
      endDate,
      clicks: Number(t?.clicks) || 0,
      impressions: Number(t?.impressions) || 0,
      ctr: round(t?.ctr, 4),
      position: t ? round(t.position, 1) : null,
      queries: (byQuery?.rows || []).map((r) => ({
        query: String(r.keys?.[0] ?? ''),
        clicks: Number(r.clicks) || 0,
        impressions: Number(r.impressions) || 0,
        position: round(r.position, 1),
      })).filter((q) => q.query),
    };
  });
}

export const clearEventSearchCache = () => cache.clear();
