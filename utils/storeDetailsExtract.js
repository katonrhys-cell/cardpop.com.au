// Reading a card shop's contact details off its own website — the pure,
// dependency-free half of "Fill in from website" in Admin → Store Directory
// (src/utils/storeDetails.js fetches the pages and calls these).
//
// Structured data first: a schema.org LocalBusiness / Store node carries the
// street address, phone and opening hours exactly as the shop publishes them
// for Google. `tel:` links and Instagram links are read from the markup as a
// fallback. Everything that leaves here is cleaned by `cleanStoreDetails()` —
// the one gate for whatever a page (or a model reading it) claims — and the
// admin still reviews the form before saving. See docs/store-pages.md.

import { MAX_STORE_HOURS_LINES } from './storePage.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ALIASES = {
  mo: 0, mon: 0, monday: 0,
  tu: 1, tue: 1, tues: 1, tuesday: 1,
  we: 2, wed: 2, wednesday: 2,
  th: 3, thu: 3, thur: 3, thurs: 3, thursday: 3,
  fr: 4, fri: 4, friday: 4,
  sa: 5, sat: 5, saturday: 5,
  su: 6, sun: 6, sunday: 6,
};

const text = (v, max) => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};

/** "https://schema.org/Monday", "Mo", "monday" → 0…6, else null. */
export function dayIndex(value) {
  const key = String(value ?? '').split('/').pop().trim().toLowerCase();
  return key in DAY_ALIASES ? DAY_ALIASES[key] : null;
}

/** "09:00", "9:00:00", "17:30" → "9am", "5:30pm"; anything else → null. */
export function formatTime(value) {
  const m = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)?$/i.exec(String(value ?? '').trim());
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] || 0);
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 24 || minute > 59) return null;
  if (hour === 24) hour = 0;
  const suffix = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${minute ? `:${String(minute).padStart(2, '0')}` : ''}${suffix}`;
}

/**
 * Seven per-day strings ("10am – 6pm", "Closed" or null when unknown) →
 * display lines, with runs of consecutive days sharing the same hours
 * collapsed: "Tuesday to Friday: 11am – 7pm".
 */
export function hoursLinesFromWeek(week) {
  const lines = [];
  let i = 0;
  while (i < 7) {
    const value = week[i];
    if (!value) { i += 1; continue; }
    let j = i;
    while (j + 1 < 7 && week[j + 1] === value) j += 1;
    lines.push(`${j > i ? `${DAYS[i]} to ${DAYS[j]}` : DAYS[i]}: ${value}`);
    i = j + 1;
  }
  return lines;
}

/** schema.org `openingHoursSpecification` → display lines. */
export function hoursFromSpecification(spec) {
  const week = Array(7).fill(null);
  for (const entry of Array.isArray(spec) ? spec : [spec]) {
    if (!entry || typeof entry !== 'object') continue;
    const opens = formatTime(entry.opens);
    const closes = formatTime(entry.closes);
    const closed = entry.opens === entry.closes && String(entry.opens ?? '').startsWith('00:00');
    if (!closed && (!opens || !closes)) continue;
    const days = Array.isArray(entry.dayOfWeek) ? entry.dayOfWeek : [entry.dayOfWeek];
    for (const day of days) {
      const idx = dayIndex(day);
      if (idx == null) continue;
      const range = closed ? 'Closed' : `${opens} – ${closes}`;
      // A second range on the same day (lunch break) is appended.
      week[idx] = week[idx] && week[idx] !== range && !closed ? `${week[idx]}, ${range}` : range;
    }
  }
  return hoursLinesFromWeek(week);
}

/** schema.org `openingHours` ("Mo-Fr 09:00-17:00", "Sa 10:00-16:00") → lines. */
export function hoursFromOpeningHours(value) {
  const week = Array(7).fill(null);
  const entries = (Array.isArray(value) ? value : [value])
    .flatMap((v) => (typeof v === 'string' ? v.split(/[;\n]/) : []));
  for (const raw of entries) {
    const m = /^([A-Za-z,\s-]+?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(raw.trim());
    if (!m) continue;
    const opens = formatTime(m[2]);
    const closes = formatTime(m[3]);
    if (!opens || !closes) continue;
    for (const part of m[1].split(',')) {
      const [from, to] = part.trim().split('-').map((d) => dayIndex(d));
      if (from == null) continue;
      const end = to == null ? from : to;
      for (let d = from; ; d = (d + 1) % 7) {
        week[d] = `${opens} – ${closes}`;
        if (d === end) break;
      }
    }
  }
  return hoursLinesFromWeek(week);
}

/** A schema.org PostalAddress (or a plain string) → one line + the suburb. */
export function addressFromSchema(address) {
  if (typeof address === 'string') return { address: text(address, 200), suburb: null };
  if (!address || typeof address !== 'object') return { address: null, suburb: null };
  const node = Array.isArray(address) ? address[0] : address;
  if (!node || typeof node !== 'object') return { address: null, suburb: null };
  const street = text(node.streetAddress, 120);
  const suburb = text(node.addressLocality, 80);
  const tail = [suburb, [text(node.addressRegion, 20), text(node.postalCode, 10)].filter(Boolean).join(' ')]
    .filter(Boolean).join(' ');
  // Without a street line this is only "Melbourne VIC" — the directory
  // already has the suburb, so it is not a street address.
  return { address: street ? [street, tail].filter(Boolean).join(', ').slice(0, 200) : null, suburb };
}

/** An Instagram profile link (not a post, reel or share link), or null. */
export function instagramProfileUrl(value) {
  if (typeof value !== 'string') return null;
  const m = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i.exec(value.trim());
  if (!m) return null;
  if (['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'share', 'tv'].includes(m[1].toLowerCase())) return null;
  return `https://www.instagram.com/${m[1]}/`;
}

/** A phone number as a person would dial it, or null. */
export function cleanPhone(value) {
  const s = text(value, 60);
  if (!s) return null;
  const phone = s.replace(/^tel:/i, '').replace(/%20/g, ' ').replace(/[^\d+()\s-]/g, '').replace(/\s+/g, ' ').trim();
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 13) return null;
  return phone.slice(0, 40);
}

/**
 * The one gate for extracted details: whatever a page's markup or a model
 * reading it reports comes out as plain, bounded text or not at all.
 * Returns { address, suburb, phone, opening_hours, instagram_url } — each a
 * string or null (`opening_hours` is newline-separated lines).
 */
export function cleanStoreDetails(raw = {}) {
  const hours = (Array.isArray(raw.opening_hours)
    ? raw.opening_hours
    : String(raw.opening_hours ?? '').split(/\r?\n/))
    .map((line) => text(line, 80))
    .filter(Boolean)
    .slice(0, MAX_STORE_HOURS_LINES);
  return {
    address: text(raw.address, 200),
    suburb: text(raw.suburb, 80),
    phone: cleanPhone(raw.phone),
    opening_hours: hours.length ? hours.join('\n') : null,
    instagram_url: instagramProfileUrl(raw.instagram_url),
  };
}

function* walkJson(node) {
  if (Array.isArray(node)) {
    for (const item of node) yield* walkJson(item);
  } else if (node && typeof node === 'object') {
    yield node;
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') yield* walkJson(value);
    }
  }
}

const decodeAttr = (s) => String(s)
  .replace(/&amp;/g, '&').replace(/&#0*38;/g, '&').replace(/&quot;/g, '"').replace(/&#0*39;/g, "'");

/**
 * Details a page states in machine-readable form: schema.org JSON-LD first,
 * then `tel:` and Instagram links in the markup. Cleaned; null where absent.
 */
export function extractStructuredStoreDetails(html) {
  const found = { address: null, suburb: null, phone: null, opening_hours: null, instagram_url: null };
  const source = String(html || '');

  const blocks = source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of blocks) {
    let data;
    try { data = JSON.parse(body.trim()); } catch { continue; }
    for (const node of walkJson(data)) {
      if (!found.address && node.address) {
        const { address, suburb } = addressFromSchema(node.address);
        if (address) { found.address = address; found.suburb = suburb; }
      }
      if (!found.phone && node.telephone) found.phone = cleanPhone(Array.isArray(node.telephone) ? node.telephone[0] : node.telephone);
      if (!found.opening_hours) {
        const lines = node.openingHoursSpecification
          ? hoursFromSpecification(node.openingHoursSpecification)
          : (node.openingHours ? hoursFromOpeningHours(node.openingHours) : []);
        if (lines.length) found.opening_hours = lines;
      }
      if (!found.instagram_url && node.sameAs) {
        for (const link of Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs]) {
          const ig = instagramProfileUrl(link);
          if (ig) { found.instagram_url = ig; break; }
        }
      }
    }
  }

  if (!found.phone) {
    const tel = /href=["']tel:([^"']+)["']/i.exec(source);
    if (tel) found.phone = cleanPhone(decodeAttr(tel[1]));
  }
  if (!found.instagram_url) {
    for (const [, href] of source.matchAll(/href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/gi)) {
      const ig = instagramProfileUrl(decodeAttr(href));
      if (ig) { found.instagram_url = ig; break; }
    }
  }
  return cleanStoreDetails(found);
}

/**
 * The shop's own "contact" / "visit us" / "store location" page, if the
 * homepage links to one on the same host — where the address and hours
 * usually live. Returns an absolute URL or null.
 */
export function findContactPageUrl(html, pageUrl) {
  let base;
  try { base = new URL(pageUrl); } catch { return null; }
  const wanted = /(contact|visit|find-us|our-store|store-location|location|opening-hours|about)/i;
  let best = null;
  for (const [, href] of String(html || '').matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    if (href.startsWith('#')) continue;
    let url;
    try { url = new URL(decodeAttr(href), base); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || url.host !== base.host) continue;
    if (url.pathname === base.pathname || !wanted.test(url.pathname)) continue;
    url.hash = '';
    // "contact" beats "about": it is where a shop puts its address and hours.
    if (/contact|visit|find-us|location|hours/i.test(url.pathname)) return url.toString();
    if (!best) best = url.toString();
  }
  return best;
}

/** `b` fills only what `a` lacks. */
export function mergeStoreDetails(a = {}, b = {}) {
  const out = {};
  for (const key of ['address', 'suburb', 'phone', 'opening_hours', 'instagram_url']) {
    out[key] = a[key] || b[key] || null;
  }
  return out;
}

export const STORE_DETAIL_LABELS = {
  address: 'street address',
  phone: 'phone',
  opening_hours: 'opening hours',
  instagram_url: 'Instagram',
};
