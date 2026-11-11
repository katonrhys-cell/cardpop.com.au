// Presentation helpers for an event page's Search Console figures
// (GET /events/:id/search-performance). Dependency-free.

/** 0.035 → "3.5%". */
export function formatCtr(ctr) {
  const pct = (Number(ctr) || 0) * 100;
  return `${pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10}%`;
}

/** Average position → "8.2", or "—" when the page has had no impressions. */
export function formatPosition(position) {
  return position == null || !Number.isFinite(Number(position)) ? '—' : String(Math.round(Number(position) * 10) / 10);
}

/** "13 Oct – 9 Nov 2026" from two YYYY-MM-DD strings. */
export function describeRange(startDate, endDate) {
  const parse = (s) => new Date(`${s}T00:00:00Z`);
  const fmt = (d, withYear) => d.toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  });
  if (!startDate || !endDate) return '';
  return `${fmt(parse(startDate), false)} – ${fmt(parse(endDate), true)}`;
}
