import crypto from 'node:crypto';
import supabase from './supabaseClient.js';
import logger from './logger.js';
import { fetchWebpageContent, extractTextFromHtml, isFetchableHttpUrl } from './safeFetch.js';
import { extractEventFromPage } from './eventScanner.js';

// Weekly re-scan of the website an admin attached to an event.
//
// The discovery scanner (eventScanner.js) finds events we don't have yet. This
// is its counterpart for events we DO have: an admin puts a URL in the event's
// "Website to scrape" field, the page is scanned immediately, and then again
// every seven days so a changed date, new ticket link or venue move is picked
// up without anyone re-checking by hand.
//
// What a scan is allowed to do to a live event is deliberately narrow:
//
//   • FILL — a field the event has no value for yet is filled in straight
//     away. That's new information, and there is nothing to overwrite.
//   • PROPOSE — a factual field that now differs from the page (dates, times,
//     venue, price…) is recorded in event_source_watches.pending_changes and
//     shown in the admin's event form with Apply / Dismiss. It is never
//     written automatically: the extractor can misread a page, and an admin's
//     hand correction must not be reverted by next week's scan.
//
// Prose fields (descriptions, SEO copy) are fill-only — the model rephrases
// them on every run, so "differs" would be noise, not news.
//
// Cost control mirrors the discovery scanner's: the page's readable text is
// hashed and an unchanged page skips the model call altogether.
//
// Runbook: docs/event-scanning.md → "Weekly re-scan of an event's website".

export const RESCAN_INTERVAL_DAYS = 7;
// A failed scan (site down, timeout) retries the next day rather than waiting
// a whole week.
const RETRY_AFTER_FAILURE_DAYS = 1;
// A scan that started this long ago and never finished (function killed at the
// ceiling) no longer blocks a new one.
const STALE_CLAIM_MS = 10 * 60 * 1000;

const MAX_WATCHES_PER_RUN = 10;
const RUN_DEADLINE_MS = 240_000;

// Filled in automatically when the event has nothing there yet.
export const FILL_FIELDS = [
  'short_description', 'description', 'featured_card_games',
  'venue_name', 'address', 'suburb', 'state', 'postcode',
  'end_date', 'start_time', 'end_time',
  'organizer_name', 'organizer_email', 'organizer_phone',
  'website_url', 'ticket_url', 'presale_fee_aud', 'capacity',
  'accessibility_info', 'age_restrictions',
  'seo_title', 'seo_description', 'seo_keywords', 'tags',
];

// Factual fields where a difference is worth an admin's attention. Never
// written without the admin applying it.
export const WATCHED_FIELDS = [
  'start_date', 'end_date', 'start_time', 'end_time',
  'venue_name', 'address', 'suburb', 'state', 'postcode',
  'entry_fee_aud', 'presale_fee_aud', 'ticket_url', 'capacity',
];

const NUMERIC_FIELDS = new Set(['entry_fee_aud', 'presale_fee_aud', 'capacity']);
const TIME_FIELDS = new Set(['start_time', 'end_time']);

const addDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);

export function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Comparable form of a value, so "10:00:00" vs "10:00" or "Hall A " vs "hall a" don't read as changes. */
export function comparable(field, value) {
  if (isBlank(value)) return null;
  if (NUMERIC_FIELDS.has(field)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (TIME_FIELDS.has(field)) return String(value).slice(0, 5);
  if (Array.isArray(value)) return value.map((v) => String(v).trim().toLowerCase()).sort().join('|');
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Stored form of a scraped value, matching what the event form writes. */
function storable(field, value) {
  if (TIME_FIELDS.has(field)) return String(value).slice(0, 5);
  return value;
}

/**
 * Compare a page extraction against the live event.
 *
 * Returns `fill` (a patch for blank fields, safe to write) and `changes` (the
 * new pending_changes map). A field is proposed only when the page actually
 * states a value — a page that stops mentioning the venue says nothing about
 * whether the venue changed.
 */
export function diffEventAgainstPage(event, extracted, { dismissed = {}, previous = {} } = {}) {
  const fill = {};
  const changes = {};
  const now = new Date().toISOString();

  for (const field of FILL_FIELDS) {
    if (isBlank(event[field]) && !isBlank(extracted[field])) {
      fill[field] = storable(field, extracted[field]);
    }
  }

  // The events table defaults entry_fee_aud to 0 with is_free, so a 0 there is
  // "free", not "unknown" — a price on the page is a proposal, not a fill.
  for (const field of WATCHED_FIELDS) {
    if (field in fill) continue;
    const found = comparable(field, extracted[field]);
    if (found === null) continue;
    const current = comparable(field, event[field]);
    if (current === null) continue; // blank → handled by fill (or not fillable)
    if (found === current) continue;
    if (field in dismissed && comparable(field, dismissed[field]) === found) continue;

    const prior = previous[field];
    changes[field] = {
      current: event[field],
      found: storable(field, extracted[field]),
      found_at: prior && comparable(field, prior.found) === found ? prior.found_at : now,
    };
  }

  return { fill, changes };
}

/** An entry fee change also has to move the free/paid switch with it. */
export function withFreeFlag(patch) {
  if ('entry_fee_aud' in patch) {
    const fee = Number(patch.entry_fee_aud) || 0;
    return { ...patch, entry_fee_aud: fee, is_free: fee === 0 };
  }
  return patch;
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Take the per-watch lock. Returns the watch row, or null when another scan of
 * the same page is already in flight (or the watch doesn't exist).
 */
async function claimWatch(eventId) {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data, error } = await supabase
    .from('event_source_watches')
    .update({ scan_started_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .or(`scan_started_at.is.null,scan_started_at.lt.${staleBefore}`)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Failed to claim watch: ${error.message}`);
  return data;
}

async function finishWatch(eventId, patch) {
  const { error } = await supabase
    .from('event_source_watches')
    .update({
      ...patch,
      scan_started_at: null,
      last_scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);
  if (error) logger.warn(`[EVENT_WATCH] Failed to record scan for ${eventId}: ${error.message}`);
}

/**
 * Scan one event's source page now. `force` skips the unchanged-page shortcut —
 * used when an admin presses "Scan now" and wants a real answer.
 */
export async function scanEventSource(eventId, { force = false } = {}) {
  const watch = await claimWatch(eventId);
  if (!watch) {
    const { data: exists } = await supabase
      .from('event_source_watches')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle();
    return exists
      ? { eventId, status: 'busy', message: 'A scan of this page is already running.' }
      : { eventId, status: 'missing', message: 'This event has no website set up for re-scanning.' };
  }

  const done = async (status, message, extra = {}) => {
    const nextDays = status === 'failed' ? RETRY_AFTER_FAILURE_DAYS : RESCAN_INTERVAL_DAYS;
    await finishWatch(eventId, {
      last_status: status,
      last_message: message,
      next_scan_at: addDays(nextDays),
      ...extra,
    });
    return { eventId, status, message, ...extra };
  };

  try {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError) throw new Error(`Failed to load event: ${eventError.message}`);
    if (!event) {
      await finishWatch(eventId, { is_active: false, last_status: 'failed', last_message: 'Event no longer exists.' });
      return { eventId, status: 'failed', message: 'Event no longer exists.' };
    }

    // Once the event is over there is nothing left to learn from its page.
    const lastDay = event.end_date || event.start_date;
    if (lastDay && lastDay < todayIso()) {
      await finishWatch(eventId, {
        is_active: false,
        last_status: 'no_change',
        last_message: 'Event has finished — weekly re-scan stopped.',
      });
      return { eventId, status: 'no_change', message: 'Event has finished — weekly re-scan stopped.' };
    }

    if (!isFetchableHttpUrl(watch.url)) {
      return done('failed', 'The website address is not a fetchable http(s) URL.');
    }

    const html = await fetchWebpageContent(watch.url, { logPrefix: 'EVENT_WATCH' });
    const pageText = extractTextFromHtml(html);
    if (pageText.length < 200) {
      return done('rejected', 'The page had almost no readable text.');
    }

    const contentHash = hashText(pageText);
    if (!force && watch.content_hash && watch.content_hash === contentHash) {
      return done('unchanged_page', 'Page unchanged since the last scan.');
    }

    const { eventData, rejected } = await extractEventFromPage(pageText, watch.url);
    if (rejected) {
      return done('rejected', `Page no longer reads as this event: ${rejected}`, { content_hash: contentHash });
    }

    const { fill, changes } = diffEventAgainstPage(event, eventData, {
      dismissed: watch.dismissed_changes || {},
      previous: watch.pending_changes || {},
    });

    const filledNames = Object.keys(fill);
    if (filledNames.length) {
      const { error: updateError } = await supabase
        .from('events')
        .update(withFreeFlag(fill))
        .eq('id', eventId);
      if (updateError) throw new Error(`Failed to save new details: ${updateError.message}`);
      logger.info(`[EVENT_WATCH] Filled ${filledNames.join(', ')} on event ${eventId} from ${watch.url}`);
    }

    const changeNames = Object.keys(changes);
    const parts = [];
    if (filledNames.length) parts.push(`Added ${filledNames.length} new detail${filledNames.length === 1 ? '' : 's'} (${filledNames.join(', ')}).`);
    if (changeNames.length) parts.push(`${changeNames.length} change${changeNames.length === 1 ? '' : 's'} to review (${changeNames.join(', ')}).`);

    const status = filledNames.length ? 'updated' : changeNames.length ? 'changes_found' : 'no_change';
    const history = [
      ...(Array.isArray(watch.filled_fields) ? watch.filled_fields : []),
      ...(filledNames.length ? [{ at: new Date().toISOString(), fields: filledNames }] : []),
    ].slice(-20);

    const result = await done(status, parts.join(' ') || 'No new information on the page.', {
      content_hash: contentHash,
      pending_changes: changes,
      filled_fields: history,
    });
    return { ...result, filled: filledNames, changes: changeNames };
  } catch (error) {
    logger.warn(`[EVENT_WATCH] Scan of ${watch.url} for event ${eventId} failed: ${error.message}`);
    return done('failed', error.message);
  }
}

/** Daily cron entrypoint: scan every active watch that has come due. */
export async function runDueEventSourceScans() {
  const deadline = Date.now() + RUN_DEADLINE_MS;
  const { data: due, error } = await supabase
    .from('event_source_watches')
    .select('event_id')
    .eq('is_active', true)
    .lte('next_scan_at', new Date().toISOString())
    .order('next_scan_at', { ascending: true })
    .limit(MAX_WATCHES_PER_RUN);
  if (error) throw new Error(`Failed to load due watches: ${error.message}`);

  const results = [];
  for (const { event_id: eventId } of due ?? []) {
    // Anything left over is still due tomorrow, so stopping early loses nothing.
    if (Date.now() > deadline) break;
    results.push(await scanEventSource(eventId));
  }

  return {
    due: due?.length ?? 0,
    scanned: results.length,
    updated: results.filter((r) => r.status === 'updated').length,
    changesFound: results.filter((r) => r.status === 'changes_found').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  };
}
