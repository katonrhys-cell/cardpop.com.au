import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ga4 = vi.hoisted(() => ({ configured: true, runReport: vi.fn() }));
vi.mock('../../src/utils/ga4Client.js', () => ({
  isGa4Configured: () => ga4.configured,
  runGa4Report: ga4.runReport,
}));

const db = vi.hoisted(() => ({ writes: [] }));
vi.mock('../../src/utils/supabaseClient.js', () => ({
  default: {
    from: (table) => ({
      upsert: (rows, opts) => { db.writes.push({ table, rows, opts }); return Promise.resolve({ error: null }); },
    }),
  },
}));

const { syncSiteTraffic, parseDailyReport, Ga4NotConfiguredError } = await import('../../src/services/siteTrafficService.js');

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

describe('syncSiteTraffic', () => {
  beforeEach(() => {
    ga4.configured = true;
    ga4.runReport.mockReset();
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
