// Search, filter and sort for the Admin → Event Management table
// (pages/admin/EventsManagementPage.jsx). Pure functions so the list logic is
// testable without rendering the page — the same shape as
// utils/adminProductList.js for the Shop Products table.
import { isPastEvent } from '@/utils/eventPast.js';

export const EVENT_STATUS_OPTIONS = [
  { value: 'approved',       label: 'Live' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'cancelled',      label: 'Cancelled' },
  { value: 'completed',      label: 'Completed' },
  { value: 'rejected',       label: 'Rejected' },
];

export const EVENT_TYPE_OPTIONS = [
  { value: 'card_show',       label: 'Card Show' },
  { value: 'trade_event',     label: 'Trade Event' },
  { value: 'community_event', label: 'Community Event' },
  { value: 'lgs_event',       label: 'LGS Event' },
];

export const EVENT_STATE_OPTIONS = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']
  .map((s) => ({ value: s, label: s }));

export const EVENT_WHEN_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past',     label: 'Past' },
];

export const EVENT_SOURCE_OPTIONS = [
  { value: 'scan',     label: 'Found by scan' },
  { value: 'manual',   label: 'Added by hand' },
  { value: 'featured', label: 'Featured' },
];

// The order an admin works through: what needs a decision first, then what's
// live, then the archive.
const STATUS_ORDER = { pending_review: 0, approved: 1, cancelled: 2, completed: 3, rejected: 4 };

const lower = (v) => String(v ?? '').trim().toLowerCase();
const isoDay = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const locationKey = (ev) => [ev.state, ev.suburb, ev.venue_name].map(lower).filter(Boolean).join(' ');

// Value readers per sortable column. Return null for a blank so it sinks.
const SORT_VALUES = {
  date:     (ev) => isoDay(ev.start_date),
  title:    (ev) => lower(ev.title) || null,
  location: (ev) => locationKey(ev) || null,
  status:   (ev) => STATUS_ORDER[ev.status] ?? 99,
  created:  (ev) => ev.created_at || null,
  updated:  (ev) => ev.updated_at || ev.created_at || null,
};

export const EVENT_SORT_KEYS = Object.keys(SORT_VALUES);

export const EVENT_SORT_OPTIONS = [
  { value: 'date',     label: 'Event date' },
  { value: 'title',    label: 'Title' },
  { value: 'location', label: 'Location' },
  { value: 'status',   label: 'Status' },
  { value: 'created',  label: 'Date added' },
  { value: 'updated',  label: 'Last updated' },
];

// Fields the search box looks through. Arrays (tags, card games) are joined.
const SEARCH_FIELDS = [
  'title', 'short_description', 'venue_name', 'address', 'suburb', 'state', 'postcode',
  'organizer_name', 'organiser_name', 'tags', 'featured_card_games',
];

const searchable = (ev) => SEARCH_FIELDS
  .map((f) => (Array.isArray(ev[f]) ? ev[f].join(' ') : ev[f]))
  .map(lower)
  .filter(Boolean)
  .join(' | ');

/**
 * Apply the search box and dropdown filters.
 *
 * @param {object[]} events
 * @param {object} filters  { search, status, type, state, when, source } — '' / 'all' means no filter
 * @param {object} [ctx]    { today } — the viewer's local `YYYY-MM-DD`, for upcoming/past
 */
export function filterEvents(events, filters = {}, ctx = {}) {
  const on = (v) => v && v !== 'all';
  // Every word typed must appear somewhere in the row, in any order, so
  // "supanova perth" finds "Supanova Comic Con — Perth".
  const words = lower(filters.search).split(/\s+/).filter(Boolean);
  return (events || []).filter((ev) => {
    if (on(filters.status) && ev.status !== filters.status) return false;
    if (on(filters.type) && ev.event_type !== filters.type) return false;
    if (on(filters.state) && lower(ev.state) !== lower(filters.state)) return false;
    if (on(filters.when)) {
      const past = isPastEvent(ev, ctx.today);
      if (filters.when === 'past' ? !past : past) return false;
    }
    if (filters.source === 'scan' && !ev.auto_discovered) return false;
    if (filters.source === 'manual' && ev.auto_discovered) return false;
    if (filters.source === 'featured' && !ev.is_featured) return false;
    if (words.length === 0) return true;
    const hay = searchable(ev);
    return words.every((w) => hay.includes(w));
  });
}

/**
 * Sort by a column. Blanks (no date, no title…) sink to the bottom in either
 * direction; ties fall back to the title so the order is stable.
 */
export function sortEvents(events, sortKey = 'date', direction = 'desc') {
  const read = SORT_VALUES[sortKey] || SORT_VALUES.date;
  const dir = direction === 'asc' ? 1 : -1;
  return [...(events || [])].sort((a, b) => {
    const va = read(a);
    const vb = read(b);
    const aBlank = va === null || va === undefined;
    const bBlank = vb === null || vb === undefined;
    if (aBlank !== bBlank) return aBlank ? 1 : -1;
    if (!aBlank && va !== vb) return (va < vb ? -1 : 1) * dir;
    return lower(a.title).localeCompare(lower(b.title));
  });
}

// The direction a column starts in when first clicked: dates newest-first,
// text A→Z, status in work order.
export const DEFAULT_SORT_DIR = { date: 'desc', created: 'desc', updated: 'desc' };
export const defaultSortDir = (key) => DEFAULT_SORT_DIR[key] || 'asc';
