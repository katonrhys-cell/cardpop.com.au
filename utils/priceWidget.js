// Embeddable "price on CardPop" widget for blogs, forums and club sites.
//
// The widget is a server-rendered SVG *image* inside a plain followed link,
// not an iframe: a link inside an iframe belongs to the framed document and
// passes nothing to CardPop, whereas `<a href="…/prices/…"><img></a>` on the
// host page is a real backlink. It also needs no script, no frame-ancestors
// change and works anywhere an <img> does (forum posts included).
//
// Dependency-free so the backend route (src/routes/public.js) and the price
// page's "Embed" dialog share it. Every figure comes from the card's
// card_price_snapshots rows — never a made-up number.

export const SITE = 'https://cardpop.com.au';
export const PRICE_WIDGET_WIDTH = 320;
export const PRICE_WIDGET_HEIGHT = 170;
/** How many of the most recent snapshots the sparkline draws. */
export const PRICE_WIDGET_DAYS = 90;

const BRAND_RED = '#CE1126';
const CHARCOAL = '#1F2937';
const GREY = '#6B7280';
const UP_GREEN = '#15803D';

export const escXml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const truncate = (s, max) => {
  const str = String(s ?? '').trim();
  return str.length > max ? `${str.slice(0, max - 1).trimEnd()}…` : str;
};

export const formatWidgetAud = (value) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  return new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', maximumFractionDigits: n >= 1000 ? 0 : 2,
  }).format(n);
};

const formatDay = (isoDate) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/** Path of the card's public price page. */
export const pricePagePath = (card) =>
  `/prices/${encodeURIComponent(card?.category || '')}/${encodeURIComponent(card?.slug || '')}`;

/** Absolute URL of the widget image (served by GET /public/price-widget/:slug.svg). */
export const priceWidgetImageUrl = (slug) =>
  `${SITE}/hcgi/api/public/price-widget/${encodeURIComponent(slug || '')}.svg`;

/** The copy-paste HTML snippet: a followed link to the price page around the live image. */
export const priceWidgetSnippet = (card) => {
  const name = card?.set_name ? `${card.name} (${card.set_name})` : (card?.name || 'Card');
  const href = `${SITE}${pricePagePath(card)}`;
  return `<a href="${escXml(href)}" title="${escXml(`${name} price in AUD on CardPop`)}">`
    + `<img src="${escXml(priceWidgetImageUrl(card?.slug))}" alt="${escXml(`${name} price in Australian dollars — CardPop`)}"`
    + ` width="${PRICE_WIDGET_WIDTH}" height="${PRICE_WIDGET_HEIGHT}" loading="lazy" style="border:0" /></a>`;
};

/**
 * The series the sparkline draws: raw averages if the card has at least two,
 * otherwise graded averages. History is oldest → newest.
 */
export const widgetSeries = (history = []) => {
  const recent = history.slice(-PRICE_WIDGET_DAYS);
  const pick = (key) => recent
    .filter((s) => s?.[key] !== null && s?.[key] !== undefined && Number.isFinite(Number(s[key])))
    .map((s) => ({ date: s.snapshot_date, value: Number(s[key]) }));
  let kind = 'raw';
  let points = pick('raw_avg');
  if (points.length < 2) {
    const graded = pick('graded_avg');
    if (graded.length >= 2 || !points.length) { kind = 'graded'; points = graded; }
  }
  const first = points[0]?.date ? Date.parse(`${points[0].date}T00:00:00Z`) : NaN;
  const last = points.at(-1)?.date ? Date.parse(`${points.at(-1).date}T00:00:00Z`) : NaN;
  const spanDays = Number.isFinite(first) && Number.isFinite(last) ? Math.round((last - first) / 86400000) : null;
  return { kind, values: points.map((p) => p.value), spanDays };
};

/** SVG path for values scaled into the box (x, y, w, h). */
export const sparklinePath = (values, { x, y, w, h }) => {
  if (!values || values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  return values.map((v, i) => {
    const px = x + i * step;
    // A flat series sits in the middle rather than on the floor.
    const py = max === min ? y + h / 2 : y + h - ((v - min) / span) * h;
    return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`;
  }).join(' ');
};

const FONT = 'font-family="Helvetica, Arial, sans-serif"';

const frame = (inner, label) => (
  `<svg xmlns="http://www.w3.org/2000/svg" width="${PRICE_WIDGET_WIDTH}" height="${PRICE_WIDGET_HEIGHT}" viewBox="0 0 ${PRICE_WIDGET_WIDTH} ${PRICE_WIDGET_HEIGHT}" role="img" aria-label="${escXml(label)}">`
  + `<title>${escXml(label)}</title>`
  + `<rect x="1" y="1" width="${PRICE_WIDGET_WIDTH - 2}" height="${PRICE_WIDGET_HEIGHT - 2}" rx="14" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="2"/>`
  + inner
  // Footer: the CardPop wordmark, so the image carries the brand wherever it is shown.
  + `<text x="16" y="${PRICE_WIDGET_HEIGHT - 14}" ${FONT} font-size="13" font-weight="800" fill="${CHARCOAL}">Card<tspan fill="${BRAND_RED}">Pop</tspan></text>`
  + '</svg>'
);

/** A neutral image for an unknown or inactive card, so an old embed never shows a broken image. */
export const priceWidgetFallbackSvg = () => frame(
  `<text x="16" y="40" ${FONT} font-size="15" font-weight="700" fill="${CHARCOAL}">Australian card prices</text>`
  + `<text x="16" y="62" ${FONT} font-size="12" fill="${GREY}">Live AUD prices for trading cards</text>`
  + `<text x="${PRICE_WIDGET_WIDTH - 16}" y="${PRICE_WIDGET_HEIGHT - 14}" text-anchor="end" ${FONT} font-size="10" fill="${GREY}">cardpop.com.au/prices</text>`,
  'Australian trading card prices on CardPop',
);

/** The widget image for one tracked card and its snapshot history (oldest → newest). */
export const priceWidgetSvg = (card, history = []) => {
  if (!card) return priceWidgetFallbackSvg();
  const latest = history.length ? history[history.length - 1] : null;
  const raw = formatWidgetAud(latest?.raw_avg);
  const graded = formatWidgetAud(latest?.graded_avg);
  const label = `${card.name}${card.set_name ? ` (${card.set_name})` : ''} price in Australian dollars on CardPop`;

  let body = `<text x="16" y="30" ${FONT} font-size="14" font-weight="700" fill="${CHARCOAL}">${escXml(truncate(card.name, 36))}</text>`;
  if (card.set_name) {
    body += `<text x="16" y="47" ${FONT} font-size="11" fill="${GREY}">${escXml(truncate(card.set_name, 46))}</text>`;
  }

  if (raw || graded) {
    const headline = raw || graded;
    const headlineLabel = raw ? 'RAW AVG' : 'GRADED AVG';
    body += `<text x="16" y="78" ${FONT} font-size="24" font-weight="800" fill="${CHARCOAL}">${escXml(headline)}</text>`;
    body += `<text x="16" y="93" ${FONT} font-size="9" font-weight="600" fill="${GREY}" letter-spacing="0.5">${headlineLabel} · AUD</text>`;
    if (raw && graded) {
      body += `<text x="${PRICE_WIDGET_WIDTH - 16}" y="62" text-anchor="end" ${FONT} font-size="9" font-weight="600" fill="${GREY}" letter-spacing="0.5">GRADED AVG</text>`;
      body += `<text x="${PRICE_WIDGET_WIDTH - 16}" y="78" text-anchor="end" ${FONT} font-size="14" font-weight="700" fill="${CHARCOAL}">${escXml(graded)}</text>`;
    }

    const series = widgetSeries(history);
    const box = { x: 16, y: 102, w: PRICE_WIDGET_WIDTH - 32, h: 30 };
    const d = sparklinePath(series.values, box);
    if (d) {
      const first = series.values[0];
      const last = series.values[series.values.length - 1];
      const up = last >= first;
      const colour = up ? UP_GREEN : BRAND_RED;
      body += `<path d="${d}" fill="none" stroke="${colour}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (first > 0) {
        const pct = ((last - first) / first) * 100;
        const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
        const span = series.spanDays > 0 ? ` · ${series.spanDays}d` : '';
        body += `<text x="${PRICE_WIDGET_WIDTH - 16}" y="93" text-anchor="end" ${FONT} font-size="10" font-weight="700" fill="${colour}">${sign}${Math.abs(pct).toFixed(1)}%${span}</text>`;
      }
    }
  } else {
    body += `<text x="16" y="82" ${FONT} font-size="13" fill="${GREY}">AUD price coming soon</text>`;
  }

  const updated = latest?.snapshot_date ? formatDay(latest.snapshot_date) : null;
  if (updated) {
    body += `<text x="${PRICE_WIDGET_WIDTH - 16}" y="${PRICE_WIDGET_HEIGHT - 14}" text-anchor="end" ${FONT} font-size="10" fill="${GREY}">Updated ${escXml(updated)}</text>`;
  }

  return frame(body, label);
};
