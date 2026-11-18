// Scheduled publishing for blog articles — the shared, dependency-free rules.
//
// A draft can carry `publish_on`, a calendar date in Australian (Sydney) time.
// The daily blog run (07:07 AEST, src/utils/blogScheduledPublish.js) publishes
// every draft whose date has arrived. The admin screen
// (pages/admin/ContentManagementPage.jsx) uses the same helpers to offer and
// label dates, so "today" means the same day in both places. See
// docs/blog-automation.md → Scheduled publishing.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` for `date` in Sydney, whatever zone the process runs in. */
export function sydneyDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** A real `YYYY-MM-DD` calendar date, or null. */
export function cleanPublishOn(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : null;
}

/** `value` + `days` as `YYYY-MM-DD`. */
export function addDays(value, days) {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True when a draft scheduled for `publishOn` is due on or before `today`. */
export function isDue(publishOn, today = sydneyDateString()) {
  const date = cleanPublishOn(publishOn);
  return Boolean(date) && date <= today;
}

/**
 * Why a date can't be scheduled, or null when it can. The daily run has
 * already happened by the time most people are at a desk, so "today" may
 * not publish until tomorrow morning — the earliest date offered is tomorrow.
 */
export function scheduleError(value, today = sydneyDateString()) {
  const date = cleanPublishOn(value);
  if (!date) return 'Choose a date.';
  if (date <= today) return 'Choose a date from tomorrow onwards — to publish today, use Publish now.';
  if (date > addDays(today, 365)) return 'Choose a date within the next year.';
  return null;
}

/** "Fri 21 Nov" for a `YYYY-MM-DD` date. */
export function formatPublishOn(value) {
  const date = cleanPublishOn(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * The next free date at least `gapDays` after the latest scheduled or
 * recently published article — the default the Schedule box offers, so a
 * queue of drafts spaces itself out instead of landing on one day.
 * `taken` is every other article's `publish_on` / published date (YYYY-MM-DD).
 */
export function suggestPublishOn(taken = [], { today = sydneyDateString(), gapDays = 3 } = {}) {
  const tomorrow = addDays(today, 1);
  const dates = taken.map(cleanPublishOn).filter(Boolean).sort();
  const latest = dates[dates.length - 1];
  if (!latest) return tomorrow;
  const next = addDays(latest, gapDays);
  return next > tomorrow ? next : tomorrow;
}
