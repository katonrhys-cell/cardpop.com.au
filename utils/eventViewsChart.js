// Geometry and wording for the owner's daily-views bar chart. Dependency-free;
// the component (components/events/EventViewsDialog.jsx) only draws what this says.

const fmtDay = (day, opts) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-AU', { timeZone: 'UTC', ...opts });

/** "11 Nov" */
export const shortDay = (day) => fmtDay(day, { day: 'numeric', month: 'short' });
/** "Tue 11 Nov" */
export const longDay = (day) => fmtDay(day, { weekday: 'short', day: 'numeric', month: 'short' });

/** A "nice" top for the y axis (a bar at the max never touches the ceiling): 1, 2, 5, 10, 20, 50 … */
export function niceMax(max) {
  const m = Math.max(1, Number(max) || 0);
  if (m <= 5) return m;                      // small counts: whole numbers, no rounding up
  const pow = 10 ** Math.floor(Math.log10(m));
  for (const step of [1, 2, 5, 10]) if (m <= step * pow) return step * pow;
  return 10 * pow;
}

/**
 * Totals and the busiest day for a series [{ day, views }].
 * `peak` is null when there were no views at all.
 */
export function summarizeSeries(series) {
  const list = Array.isArray(series) ? series : [];
  let total = 0;
  let peak = null;
  for (const p of list) {
    total += p.views;
    if (p.views > 0 && (!peak || p.views > peak.views)) peak = { day: p.day, views: p.views };
  }
  return { total, peak, days: list.length };
}

/** y-axis gridline positions as fractions of the scale: whole-number scales ≤ 5 get only 0 and the top (a half would be a fraction). */
export const axisTicks = (yMax) => (yMax <= 5 ? [0, 1] : [0, 0.5, 1]);

/**
 * Bars for an SVG of `width` × `height` (the plot area, axes drawn outside it).
 * Each bar: { x, y, w, h, day, views }. A day with views always gets a visible
 * bar (min 2 px); a day with none gets h = 0.
 */
export function barGeometry(series, { width = 600, height = 160, gap = 2 } = {}) {
  const list = Array.isArray(series) ? series : [];
  if (!list.length) return { bars: [], yMax: 1 };
  const yMax = niceMax(Math.max(0, ...list.map((p) => p.views)));
  const slot = width / list.length;
  const w = Math.max(1, slot - gap);
  const bars = list.map((p, i) => {
    const h = p.views > 0 ? Math.max(2, (p.views / yMax) * height) : 0;
    return { x: i * slot + gap / 2, y: height - h, w, h, day: p.day, views: p.views };
  });
  return { bars, yMax };
}

/** One sentence for screen readers: the whole picture without the chart. */
export function describeSeries(series) {
  const { total, peak, days } = summarizeSeries(series);
  if (!days) return 'No view data.';
  if (!total) return `No views in the last ${days} days.`;
  return `${total.toLocaleString('en-AU')} view${total === 1 ? '' : 's'} in the last ${days} days`
    + (peak ? `; busiest day ${longDay(peak.day)} with ${peak.views.toLocaleString('en-AU')}.` : '.');
}
