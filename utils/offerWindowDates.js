// Expression of Interest offer window ↔ <input type="date"> values.
//
// Sellers pick whole days; the listing stores timestamps
// (listings.offers_open_at / offers_close_at). Days are the seller's own local
// days: offers open at the start of the opening date and close at the end of
// the closing date — stored as midnight starting the following day, so the
// close is an exclusive bound and "closes 14 Nov" really includes all of the
// 14th. Dependency-free so the SPA and the backend can both import it.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateInput = (value) => {
  const m = DATE_RE.exec(String(value ?? '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "2026-11-01" → ISO for local midnight starting that day; blank → null. */
export function openDateToTimestamp(value) {
  const d = parseDateInput(value);
  return d ? d.toISOString() : null;
}

/** "2026-11-14" → ISO for local midnight ending that day; blank → null. */
export function closeDateToTimestamp(value) {
  const d = parseDateInput(value);
  if (!d) return null;
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/** offers_open_at → the date input value it was picked as. */
export function timestampToOpenDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : toDateInput(d);
}

/** offers_close_at (exclusive) → the last day offers are taken. */
export function timestampToCloseDate(ts) {
  if (!ts) return '';
  const d = new Date(new Date(ts).getTime() - 1);
  return Number.isNaN(d.getTime()) ? '' : toDateInput(d);
}

/** Today as a date input value (local) — the min for a closing date. */
export const todayDateInput = (now = new Date()) => toDateInput(now);

/**
 * Validate a picked window. Returns { offerOpenDate?, offerCloseDate? } error
 * messages keyed by field; {} when fine. Both dates are optional.
 */
export function validateOfferWindowDates(openDate, closeDate, now = new Date()) {
  const errors = {};
  const open = openDate ? parseDateInput(openDate) : null;
  const close = closeDate ? parseDateInput(closeDate) : null;
  if (openDate && !open) errors.offerOpenDate = 'Enter a valid opening date';
  if (closeDate && !close) errors.offerCloseDate = 'Enter a valid closing date';
  if (close && toDateInput(close) < toDateInput(now)) {
    errors.offerCloseDate = 'The closing date can’t be in the past';
  } else if (open && close && close < open) {
    errors.offerCloseDate = 'The closing date must be on or after the opening date';
  }
  return errors;
}

/** Display a window for buyers, e.g. "Offers close Fri 14 Nov". */
export function formatOfferWindowDate(ts) {
  return new Date(ts).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The buyer-facing one-liner for a window state, or null when there's
 * nothing to say (open with no closing date).
 */
export function describeOfferWindow(listing, state) {
  if (state === 'upcoming') return `Offers open ${formatOfferWindowDate(listing.offers_open_at)}`;
  if (state === 'closed') return 'Offers closed';
  if (listing?.offers_close_at) {
    // Show the last day offers are taken (the stored bound is exclusive).
    return `Offers close ${formatOfferWindowDate(new Date(new Date(listing.offers_close_at).getTime() - 1))}`;
  }
  return null;
}
