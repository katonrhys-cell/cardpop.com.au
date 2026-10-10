/**
 * Site traffic sync — GA4 → site_traffic_daily / site_traffic_summary.
 *
 * Run nightly by .github/workflows/cron-daily.yml (GET
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
 * Reports only ever read; the service writes with the service-role client.
 * Runbook: docs/site-traffic.md.
 */
import supabase from '../utils/supabaseClient.js';
import { isGa4Configured, runGa4Report } from '../utils/ga4Client.js';
import logger from '../utils/logger.js';

// Earliest day to ask GA4 for. GA4 returns nothing for days before the
// property existed, so a generous default is harmless; set GA4_START_DATE to
// the launch date to make "since launch" exact.
const DEFAULT_START_DATE = '2025-01-01';
const UPSERT_CHUNK = 500;

export class Ga4NotConfiguredError extends Error {
  constructor() {
    super('GA4 is not configured: set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON');
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

/**
 * Pull GA4 and refresh both tables. Resolves to a small summary for the
 * cron log / admin toast. Throws Ga4NotConfiguredError when the env vars are
 * missing so callers can answer 503 rather than 502.
 */
export const syncSiteTraffic = async () => {
  if (!isGa4Configured()) throw new Ga4NotConfiguredError();

  const [allTime, last30] = await Promise.all([
    byDateReport({ startDate: startDate(), endDate: 'yesterday' }).then(parseDailyReport),
    byDateReport({ startDate: '30daysAgo', endDate: 'yesterday' }).then(parseDailyReport),
  ]);

  const syncedAt = new Date().toISOString();
  await upsertDaily(allTime.days, syncedAt);

  // "Since launch" = the first day GA4 recorded a session, not the arbitrary
  // query start.
  const firstActive = allTime.days.find((d) => d.sessions > 0 || d.users > 0) || null;
  const window = last30.days.length
    ? { window_start: last30.days[0].day, window_end: last30.days[last30.days.length - 1].day }
    : { window_start: null, window_end: null };

  const summary = {
    id: true,
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
  return {
    days: allTime.days.length,
    visitors_30d: summary.visitors_30d,
    visitors_all_time: summary.visitors_all_time,
    since_date: summary.since_date,
    window_start: summary.window_start,
    window_end: summary.window_end,
    synced_at: syncedAt,
  };
};
