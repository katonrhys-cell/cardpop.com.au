/**
 * Site traffic (visitor counts) — presentation helpers shared by the home page
 * stats strip and the admin dashboard's Visitors card.
 *
 * The numbers come from `site_traffic_summary` / `site_traffic_daily`, filled
 * nightly from Google Analytics 4 (src/services/siteTrafficService.js). These
 * helpers are dependency-free so they can be unit-tested without React.
 * Runbook: docs/site-traffic.md.
 */

// The public tile stays hidden until the site has a 30-day visitor count worth
// showing: a tiny number is a worse signal to a buyer than no number at all.
// (The rest of the strip already hides zero counts for the same reason.)
export const MIN_PUBLIC_VISITORS_30D = 100;

// A summary older than this is stale enough that the public tile is better
// off hidden than showing last season's figures (the sync runs nightly).
export const MAX_PUBLIC_SUMMARY_AGE_DAYS = 14;

const int = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/** "12,345" in en-AU grouping. */
export const formatCount = (n) => int(n).toLocaleString('en-AU');

/** "12.3k" / "1.2M" for tight spaces (the strip's secondary line). */
export const formatCompact = (n) => {
  const v = int(n);
  if (v < 10_000) return v.toLocaleString('en-AU');
  if (v < 1_000_000) return `${(v / 1_000).toFixed(v < 100_000 ? 1 : 0).replace(/\.0$/, '')}k`;
  return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
};

/** "Sep 2025" — how the public tile names the launch month. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const formatSinceMonth = (isoDate) => {
  // Fixed table rather than Intl: en-AU's CLDR "short" months are "June" /
  // "Sept", which read oddly next to the others and differ between runtimes.
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(isoDate || ''));
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : null;
};

const ageInDays = (iso, now) => {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (now - t) / 86_400_000;
};

/**
 * Turn a site_traffic_summary row into the home page stat tile, or null when
 * there's nothing honest to show (no row, too few visitors, stale sync).
 *
 * Headline = visitors in the last 30 days (that's what "how many people are
 * landing on the site" means today); the secondary line carries the all-time
 * figure so the tile shows both.
 */
export const publicTrafficStat = (summary, { now = Date.now() } = {}) => {
  if (!summary) return null;
  const visitors30d = int(summary.visitors_30d);
  const allTime = int(summary.visitors_all_time);
  if (visitors30d < MIN_PUBLIC_VISITORS_30D) return null;
  if (ageInDays(summary.synced_at, now) > MAX_PUBLIC_SUMMARY_AGE_DAYS) return null;

  const since = formatSinceMonth(summary.since_date);
  // All-time can't honestly be lower than the last 30 days; if GA4's start
  // date was set after the launch it would be, so show the larger figure.
  const allTimeShown = Math.max(allTime, visitors30d);
  return {
    key: 'visitors',
    value: visitors30d,
    label: 'Visitors · last 30 days',
    sub: `${formatCompact(allTimeShown)} since ${since ? `${since}` : 'launch'}`,
  };
};

/**
 * Daily rows → sparkline geometry. Returns null with fewer than 2 points.
 * `rows` are { day, users } in any order; output is ordered by day.
 */
export const sparklinePath = (rows, { width = 160, height = 36, pad = 2, key = 'users' } = {}) => {
  const pts = (rows || [])
    .filter((r) => r && r.day)
    .map((r) => ({ day: r.day, value: int(r[key]) }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  if (pts.length < 2) return null;
  const max = Math.max(1, ...pts.map((p) => p.value));
  const stepX = (width - pad * 2) / (pts.length - 1);
  const points = pts.map((p, i) => ({
    ...p,
    x: +(pad + i * stepX).toFixed(2),
    y: +(height - pad - (p.value / max) * (height - pad * 2)).toFixed(2),
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const area = `${line} L${points[points.length - 1].x} ${height - pad} L${points[0].x} ${height - pad} Z`;
  return { points, line, area, max, width, height };
};
