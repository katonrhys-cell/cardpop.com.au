import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ga4 = vi.hoisted(() => ({ configured: true, runReport: vi.fn() }));
vi.mock('../../src/utils/ga4Client.js', () => ({
  isGa4Configured: () => ga4.configured,
  runGa4Report: ga4.runReport,
}));

const gsc = vi.hoisted(() => ({ configured: false, query: vi.fn() }));
vi.mock('../../src/utils/searchConsoleClient.js', () => ({
  isSearchConsoleConfigured: () => gsc.configured,
  runSearchAnalytics: gsc.query,
}));

const db = vi.hoisted(() => ({ writes: [] }));
vi.mock('../../src/utils/supabaseClient.js', () => ({
  default: {
    from: (table) => ({
      upsert: (rows, opts) => { db.writes.push({ table, rows, opts }); return Promise.resolve({ error: null }); },
    }),
  },
}));

const { syncSiteTraffic, parseDailyReport, parseSearchReport, Ga4NotConfiguredError } = await import('../../src/services/siteTrafficService.js');

const searchRow = (date, clicks, impressions) => ({ keys: [date], clicks, impressions, ctr: 0, position: 0 });

const row = (date, users, sessions, views) => ({
  dimensionValues: [{ value: date }],
  metricValues: [{ value: String(users) }, { value: String(sessions) }, { value: String(views) }],
});
const report = (rows, totals) => ({
  rows,
  totals: totals ? [{ metricValues: [{ value: String(totals[0]) }, { value: String(totals[1]) }, { value: String(totals[2]) }] }] : undefined,
});

const originalStart = process.env.GA4_START_DATE;

describe('parseDailyReport', () => {
  it('maps GA4 date rows to ISO days and prefers the de-duplicated TOTAL row', () => {
    const { days, totals } = parseDailyReport(report([row('20260902', 5, 6, 20), row('20260901', 3, 4, 10)], [7, 10, 30]));
    expect(days).toEqual([
      { day: '2026-09-01', users: 3, sessions: 4, pageviews: 10 },
      { day: '2026-09-02', users: 5, sessions: 6, pageviews: 20 },
    ]);
    // 7 < 3 + 5: GA4 de-duplicates a visitor who came on both days.
    expect(totals).toEqual({ users: 7, sessions: 10, pageviews: 30 });
  });

  it('falls back to summing rows when GA4 omits totals, and ignores junk rows', () => {
    const { days, totals } = parseDailyReport(report([row('20260901', 3, 4, 10), { dimensionValues: [{ value: '(other)' }] }]));
    expect(days).toHaveLength(1);
    expect(totals).toEqual({ users: 3, sessions: 4, pageviews: 10 });
  });

  it('handles an empty report', () => {
    expect(parseDailyReport({})).toEqual({ days: [], totals: { users: 0, sessions: 0, pageviews: 0 } });
  });
});

describe('parseSearchReport', () => {
  const today = '2026-10-31';

  it('sums clicks and impressions over the whole range and over the last 30 reportable days', () => {
    const { days, totals, last30 } = parseSearchReport({ rows: [
      searchRow('2026-10-29', 4, 120),      // inside the window (lags two days, still counts)
      searchRow('2026-10-01', 2, 60),       // window start
      searchRow('2026-09-30', 10, 1000),    // the day before the window
      { keys: ['(other)'], clicks: 99, impressions: 99 },
    ] }, { today });
    expect(days.map((d) => d.day)).toEqual(['2026-09-30', '2026-10-01', '2026-10-29']);
    expect(days[0]).toEqual({ day: '2026-09-30', search_clicks: 10, search_impressions: 1000 });
    expect(totals).toEqual({ clicks: 16, impressions: 1180 });
    expect(last30).toEqual({ clicks: 6, impressions: 180, window_start: '2026-10-01', window_end: '2026-10-30' });
  });

  it('handles an empty report', () => {
    expect(parseSearchReport({}, { today }).totals).toEqual({ clicks: 0, impressions: 0 });
    expect(parseSearchReport(null, { today }).days).toEqual([]);
  });
});

describe('syncSiteTraffic', () => {
  beforeEach(() => {
    ga4.configured = true;
    ga4.runReport.mockReset();
    gsc.configured = false;
    gsc.query.mockReset();
    db.writes.length = 0;
    process.env.GA4_START_DATE = '2026-06-01';
  });
  afterEach(() => {
    if (originalStart === undefined) delete process.env.GA4_START_DATE;
    else process.env.GA4_START_DATE = originalStart;
  });

  it('throws Ga4NotConfiguredError without credentials and never calls GA4', async () => {
    ga4.configured = false;
    await expect(syncSiteTraffic()).rejects.toBeInstanceOf(Ga4NotConfiguredError);
    expect(ga4.runReport).not.toHaveBeenCalled();
    expect(db.writes).toHaveLength(0);
  });

  it('adds the Search Console figures in their own columns, after the GA4 write', async () => {
    gsc.configured = true;
    ga4.runReport.mockResolvedValue(report([row('20260903', 50, 60, 200)], [50, 60, 200]));
    gsc.query.mockResolvedValue({ rows: [searchRow('2026-06-03', 1, 40), searchRow('2026-09-03', 7, 300)] });

    const result = await syncSiteTraffic();

    // One query, by date, as far back as GA4_START_DATE, including fresh days.
    expect(gsc.query).toHaveBeenCalledTimes(1);
    expect(gsc.query.mock.calls[0][0]).toMatchObject({ startDate: '2026-06-01', dimensions: ['date'], dataState: 'all' });
    expect(gsc.query.mock.calls[0][0].endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const summaries = db.writes.filter((w) => w.table === 'site_traffic_summary');
    expect(summaries).toHaveLength(2);
    // GA4's row carries no search columns and the search row carries no GA4
    // ones, so neither source can blank the other.
    expect(summaries[0].rows).toMatchObject({ id: true, visitors_30d: 50 });
    expect(summaries[0].rows).not.toHaveProperty('search_clicks_30d');
    expect(summaries[1].rows).toMatchObject({
      id: true,
      search_clicks_all_time: 8,
      search_impressions_all_time: 340,
      search_since_date: '2026-06-03',
    });
    expect(summaries[1].rows).not.toHaveProperty('visitors_30d');
    expect(summaries[1].rows.search_synced_at).toBe(summaries[0].rows.synced_at);

    const searchDaily = db.writes.filter((w) => w.table === 'site_traffic_daily')[1];
    expect(searchDaily.rows[1]).toMatchObject({ day: '2026-09-03', search_clicks: 7, search_impressions: 300 });
    expect(searchDaily.rows[1]).not.toHaveProperty('users');

    expect(result).toMatchObject({ visitors_30d: 50, search_days: 2, search_clicks_all_time: 8, search_impressions_all_time: 340 });
  });

  it('runs Search Console on its own when GA4 is not configured', async () => {
    ga4.configured = false;
    gsc.configured = true;
    gsc.query.mockResolvedValue({ rows: [searchRow('2026-09-03', 7, 300)] });
    const result = await syncSiteTraffic();
    expect(ga4.runReport).not.toHaveBeenCalled();
    expect(result).toMatchObject({ search_clicks_all_time: 7 });
    expect(result).not.toHaveProperty('visitors_30d');
    expect(db.writes.filter((w) => w.table === 'site_traffic_summary')).toHaveLength(1);
  });

  it('keeps the GA4 figures when Search Console fails, and still reports the failure', async () => {
    gsc.configured = true;
    ga4.runReport.mockResolvedValue(report([row('20260903', 50, 60, 200)], [50, 60, 200]));
    gsc.query.mockRejectedValue(new Error('Search Console query failed (403)'));
    await expect(syncSiteTraffic()).rejects.toThrow(/403/);
    expect(db.writes.filter((w) => w.table === 'site_traffic_summary')).toHaveLength(1);
    expect(db.writes.find((w) => w.table === 'site_traffic_summary').rows).toMatchObject({ visitors_30d: 50 });
  });

  it('writes the daily rows and a single summary row from the two reports', async () => {
    ga4.runReport.mockImplementation(async (req) => {
      const range = req.dateRanges[0];
      if (range.startDate === '2026-06-01') {
        // All-time: the first two days are empty (keepEmptyRows), launch is the 3rd.
        return report([row('20260601', 0, 0, 0), row('20260602', 0, 0, 0), row('20260603', 12, 15, 40), row('20260903', 50, 60, 200)], [55, 75, 240]);
      }
      if (range.startDate === '30daysAgo') {
        return report([row('20260804', 1, 1, 1), row('20260903', 50, 60, 200)], [48, 61, 201]);
      }
      throw new Error(`unexpected range ${JSON.stringify(range)}`);
    });

    const result = await syncSiteTraffic();

    const daily = db.writes.find((w) => w.table === 'site_traffic_daily');
    expect(daily.opts).toEqual({ onConflict: 'day' });
    expect(daily.rows).toHaveLength(4);
    expect(daily.rows[2]).toMatchObject({ day: '2026-06-03', users: 12, sessions: 15, pageviews: 40, source: 'ga4' });

    const summary = db.writes.find((w) => w.table === 'site_traffic_summary');
    expect(summary.opts).toEqual({ onConflict: 'id' });
    expect(summary.rows).toMatchObject({
      id: true,
      visitors_30d: 48,
      sessions_30d: 61,
      pageviews_30d: 201,
      visitors_all_time: 55,
      sessions_all_time: 75,
      pageviews_all_time: 240,
      since_date: '2026-06-03',
      window_start: '2026-08-04',
      window_end: '2026-09-03',
    });

    expect(result).toMatchObject({ days: 4, visitors_30d: 48, visitors_all_time: 55, since_date: '2026-06-03' });
    // Both reports ask for the de-duplicated total and the date dimension.
    for (const call of ga4.runReport.mock.calls) {
      expect(call[0].metricAggregations).toEqual(['TOTAL']);
      expect(call[0].dimensions).toEqual([{ name: 'date' }]);
    }
  });

  it('ignores a malformed GA4_START_DATE and uses the default', async () => {
    process.env.GA4_START_DATE = 'yesterday-ish';
    ga4.runReport.mockResolvedValue(report([], [0, 0, 0]));
    await syncSiteTraffic();
    const allTimeCall = ga4.runReport.mock.calls.find((c) => c[0].dateRanges[0].startDate !== '30daysAgo');
    expect(allTimeCall[0].dateRanges[0].startDate).toBe('2025-01-01');
  });
});
