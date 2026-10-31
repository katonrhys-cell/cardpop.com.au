/**
 * Site traffic sync — GA4 + Search Console → site_traffic_daily /
 * site_traffic_summary.
 *
 * Run nightly by the Cloudflare scheduler Worker (cloudflare/scheduler/worker.js, GET
 * /api/site-traffic/sync) and on demand from Admin → Dashboard → Visitors →
 * "Sync now" (POST /admin/site-traffic/sync). Two GA4 reports per run:
 *
 *   1. All days since GA4_START_DATE, by date, with a TOTAL aggregation.
 *      The rows refresh site_traffic_daily (GA4 finalises a day up to ~48h
 *      late, so re-pulling the whole history every night self-heals; it is
 *      a few hundred rows). The TOTAL row gives the all-time figures, and
 *      GA4 de-duplicates activeUsers across the range — summing the daily
 *      rows would count a returning visitor once per day instead.
 *   2. The trailing 30 days (30daysAgo → yesterday), by date, with a TOTAL
 *      aggregation, for the "last 30 days" figures and the window it covers.
 *
 * Then, when GSC_SITE_URL is set, one Search Console query (by date, as far
 * back as Search Console keeps data — 16 months) for the home page's "Found
 * on Google" tiles: clicks and impressions over the last 30 days plus the
 * since-launch totals. Clicks and impressions are additive across days, so
 * the totals are sums of the daily rows (unlike GA4's users). Each source
 * writes only its own columns, so one being unconfigured or failing never
 * blanks the other's figures; a Search Console failure is reported after the
 * GA4 figures are safely written.
 *
 * Reports only ever read; the service writes with the service-role client.
 * Runbook: docs/site-traffic.md.
 */
import supabase from '../utils/supabaseClient.js';
import { isGa4Configured, runGa4Report } from '../utils/ga4Client.js';
import { isSearchConsoleConfigured, runSearchAnalytics } from '../utils/searchConsoleClient.js';
import logger from '../utils/logger.js';

// Earliest day to ask GA4 for. GA4 returns nothing for days before the
// property existed, so a generous default is harmless; set GA4_START_DATE to
// the launch date to make "since launch" exact.
const DEFAULT_START_DATE = '2025-01-01';
const UPSERT_CHUNK = 500;

// Search Console keeps 16 months of data; asking for earlier days is harmless
// but pointless, so the all-time query starts at the later of this and
// GA4_START_DATE.
const SEARCH_CONSOLE_RETENTION_DAYS = 480;
const SEARCH_WINDOW_DAYS = 30;

export class Ga4NotConfiguredError extends Error {
  constructor() {
    super('GA4 is not configured: set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON (and GSC_SITE_URL for Search Console)');
    this.name = 'Ga4NotConfiguredError';
  }
}

const METRICS = [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }];

const startDate = () => {
  const raw = String(process.env.GA4_START_DATE || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : DEFAULT_START_DATE;
};

const toInt = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// GA4's `date` dimension is YYYYMMDD; the table wants an ISO date.
const isoDay = (yyyymmdd) => {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(yyyymmdd || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

const metricsOf = (metricValues = []) => ({
  users: toInt(metricValues[0]?.value),
  sessions: toInt(metricValues[1]?.value),
  pageviews: toInt(metricValues[2]?.value),
});

/** Normalise a by-date GA4 report into { days, totals }. Exported for tests. */
export const parseDailyReport = (report) => {
  const days = [];
  for (const row of report?.rows || []) {
    const day = isoDay(row.dimensionValues?.[0]?.value);
    if (!day) continue;
    days.push({ day, ...metricsOf(row.metricValues) });
  }
  days.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  // `totals` is the de-duplicated aggregate GA4 returns for metricAggregations
  // TOTAL. Fall back to summing rows (sessions/pageviews are additive; users
  // would then over-count, but only when GA4 omitted the totals row).
  const totalRow = report?.totals?.[0]?.metricValues;
  const totals = totalRow
    ? metricsOf(totalRow)
    : days.reduce((acc, d) => ({
        users: acc.users + d.users,
        sessions: acc.sessions + d.sessions,
        pageviews: acc.pageviews + d.pageviews,
      }), { users: 0, sessions: 0, pageviews: 0 });
  return { days, totals };
};

const byDateReport = (dateRange) => runGa4Report({
  dateRanges: [dateRange],
  dimensions: [{ name: 'date' }],
  metrics: METRICS,
  metricAggregations: ['TOTAL'],
  orderBys: [{ dimension: { dimensionName: 'date' } }],
  keepEmptyRows: true,
  limit: 100000,
});

const upsertDaily = async (days, syncedAt) => {
  for (let i = 0; i < days.length; i += UPSERT_CHUNK) {
    const chunk = days.slice(i, i + UPSERT_CHUNK).map((d) => ({ ...d, source: 'ga4', synced_at: syncedAt }));
    const { error } = await supabase.from('site_traffic_daily').upsert(chunk, { onConflict: 'day' });
    if (error) throw new Error(`site_traffic_daily upsert failed: ${error.message}`);
  }
};

// ─── Search Console ──────────────────────────────────────────────────────────

const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
};

/**
 * Normalise a by-date Search Console response into { days, totals } and the
 * last-30-days slice. `today` is injectable for tests. Exported for tests.
 */
export const parseSearchReport = (report, { today = isoDate(new Date()) } = {}) => {
  const days = [];
  for (const row of report?.rows || []) {
    const day = row.keys?.[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) continue;
    days.push({ day, search_clicks: toInt(row.clicks), search_impressions: toInt(row.impressions) });
  }
  days.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const sum = (rows) => rows.reduce((acc, d) => ({
    clicks: acc.clicks + d.search_clicks,
    impressions: acc.impressions + d.search_impressions,
  }), { clicks: 0, impressions: 0 });
  // Search Console lags two or three days, so the window is the last 30 days
  // it could have reported, not the last 30 rows: a quiet day still counts.
  const windowEnd = addDays(today, -1);
  const windowStart = addDays(windowEnd, -(SEARCH_WINDOW_DAYS - 1));
  const window = days.filter((d) => d.day >= windowStart && d.day <= windowEnd);
  return {
    days,
    totals: sum(days),
    last30: { ...sum(window), window_start: windowStart, window_end: windowEnd },
  };
};

const searchStartDate = (today) => {
  const earliest = addDays(today, -SEARCH_CONSOLE_RETENTION_DAYS);
  const configured = startDate();
  return configured > earliest ? configured : earliest;
};

const upsertSearchDaily = async (days, syncedAt) => {
  for (let i = 0; i < days.length; i += UPSERT_CHUNK) {
    // Only the search columns: a day GA4 has already written keeps its
    // users / sessions / pageviews, a day it hasn't gets the column defaults.
    const chunk = days.slice(i, i + UPSERT_CHUNK).map((d) => ({ ...d, synced_at: syncedAt }));
    const { error } = await supabase.from('site_traffic_daily').upsert(chunk, { onConflict: 'day' });
    if (error) throw new Error(`site_traffic_daily (search) upsert failed: ${error.message}`);
  }
};

const syncSearchConsole = async (syncedAt) => {
  const today = isoDate(new Date());
  const report = await runSearchAnalytics({
    startDate: searchStartDate(today),
    endDate: addDays(today, -1),
    dimensions: ['date'],
    // 'all' includes the last two or three not-yet-final days; tonight's
    // re-pull overwrites them once Google finalises them.
    dataState: 'all',
    rowLimit: 1000,
  });
  const parsed = parseSearchReport(report, { today });
  await upsertSearchDaily(parsed.days, syncedAt);

  const firstActive = parsed.days.find((d) => d.search_impressions > 0 || d.search_clicks > 0) || null;
  return {
    search_clicks_30d: parsed.last30.clicks,
    search_impressions_30d: parsed.last30.impressions,
    search_clicks_all_time: parsed.totals.clicks,
    search_impressions_all_time: parsed.totals.impressions,
    search_window_start: parsed.last30.window_start,
    search_window_end: parsed.last30.window_end,
    search_since_date: firstActive?.day || null,
    search_synced_at: syncedAt,
    _days: parsed.days.length,
  };
};

/**
 * Pull GA4 (and Search Console when configured) and refresh both tables.
 * Resolves to a small summary for the cron log / admin toast. Throws
 * Ga4NotConfiguredError when neither source has credentials so callers can
 * answer 503 rather than 502.
 */
export const syncSiteTraffic = async () => {
  const ga4 = isGa4Configured();
  const gsc = isSearchConsoleConfigured();
  if (!ga4 && !gsc) throw new Ga4NotConfiguredError();

  const syncedAt = new Date().toISOString();
  const result = { synced_at: syncedAt };
  let summary = { id: true };

  if (ga4) {
    const [allTime, last30] = await Promise.all([
      byDateReport({ startDate: startDate(), endDate: 'yesterday' }).then(parseDailyReport),
      byDateReport({ startDate: '30daysAgo', endDate: 'yesterday' }).then(parseDailyReport),
    ]);

    await upsertDaily(allTime.days, syncedAt);

    // "Since launch" = the first day GA4 recorded a session, not the arbitrary
    // query start.
    const firstActive = allTime.days.find((d) => d.sessions > 0 || d.users > 0) || null;
    const window = last30.days.length
      ? { window_start: last30.days[0].day, window_end: last30.days[last30.days.length - 1].day }
      : { window_start: null, window_end: null };

    summary = {
      ...summary,
      visitors_30d: last30.totals.users,
      sessions_30d: last30.totals.sessions,
      pageviews_30d: last30.totals.pageviews,
      visitors_all_time: allTime.totals.users,
      sessions_all_time: allTime.totals.sessions,
      pageviews_all_time: allTime.totals.pageviews,
      since_date: firstActive?.day || null,
      source: 'ga4',
      synced_at: syncedAt,
      ...window,
    };
    const { error } = await supabase.from('site_traffic_summary').upsert(summary, { onConflict: 'id' });
    if (error) throw new Error(`site_traffic_summary upsert failed: ${error.message}`);

    logger.info(`[SITE_TRAFFIC] Synced ${allTime.days.length} days · 30d visitors ${summary.visitors_30d} · all-time ${summary.visitors_all_time}`);
    Object.assign(result, {
      days: allTime.days.length,
      visitors_30d: summary.visitors_30d,
      visitors_all_time: summary.visitors_all_time,
      since_date: summary.since_date,
      window_start: summary.window_start,
      window_end: summary.window_end,
    });
  }

  if (gsc) {
    // After GA4 has written, so a Search Console failure (thrown below, to
    // keep the cron run red) never costs the visitor figures.
    const { _days, ...search } = await syncSearchConsole(syncedAt);
    const { error } = await supabase.from('site_traffic_summary').upsert({ id: true, ...search }, { onConflict: 'id' });
    if (error) throw new Error(`site_traffic_summary (search) upsert failed: ${error.message}`);

    logger.info(`[SITE_TRAFFIC] Search Console: ${_days} days · 30d clicks ${search.search_clicks_30d} · impressions ${search.search_impressions_30d}`);
    Object.assign(result, {
      search_days: _days,
      search_clicks_30d: search.search_clicks_30d,
      search_impressions_30d: search.search_impressions_30d,
      search_clicks_all_time: search.search_clicks_all_time,
      search_impressions_all_time: search.search_impressions_all_time,
      search_since_date: search.search_since_date,
    });
  }

  return result;
};
