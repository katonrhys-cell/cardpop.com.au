// Where an organiser's own event sits in its lifecycle, for Account → My
// Events and the dashboard's Active Events tile. One answer for both, so the
// tile's count and the page's "Live" tab can never disagree.
//
// Dependency-free: dates are the DB's ISO `YYYY-MM-DD` strings and `today` is
// the Australian calendar day (todayInAustralia() in utils/featuredPackages.js),
// so plain string comparison is a correct date comparison.

import { eventLastDay, isPastEvent } from './eventPast.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

// Display order of the page's tabs. `all` is the page's default view.
export const MY_EVENT_BUCKETS = [
  { key: 'all',      label: 'All' },
  { key: 'now',      label: 'Happening now', description: 'Live on the calendar and on today.' },
  { key: 'live',     label: 'Live',          description: 'Approved and upcoming on the public calendar.' },
  { key: 'pending',  label: 'Pending approval', description: 'With the CardPop team for review.' },
  { key: 'draft',    label: 'Drafts',        description: 'Private to you until you submit.' },
  { key: 'past',     label: 'Past',          description: 'Finished events — they keep their public page.' },
  { key: 'declined', label: 'Not approved',  description: 'Rejected or cancelled. A rejected event can be edited and resubmitted.' },
];

export const MY_EVENT_BUCKET_KEYS = MY_EVENT_BUCKETS.map((b) => b.key);

const firstDay = (event) => {
  const m = typeof event?.start_date === 'string' ? event.start_date.match(ISO_DATE_RE) : null;
  return m ? m[0] : null;
};

// Is an approved event on today (between its first and last day inclusive)?
const isOnToday = (event, today) => {
  const start = firstDay(event);
  const end = eventLastDay(event);
  if (!start || !end || !ISO_DATE_RE.test(today || '')) return false;
  return start <= today && today <= end;
};

export const myEventBucket = (event, today) => {
  switch (event?.status) {
    case 'draft': return 'draft';
    case 'pending_review': return 'pending';
    case 'rejected':
    case 'cancelled': return 'declined';
    case 'completed': return 'past';
    case 'approved':
      if (isPastEvent(event, today)) return 'past';
      if (isOnToday(event, today)) return 'now';
      return 'live';
    default: return 'pending';
  }
};

// { all, now, live, pending, draft, past, declined } counts.
export const countMyEventBuckets = (events, today) => {
  const counts = Object.fromEntries(MY_EVENT_BUCKET_KEYS.map((k) => [k, 0]));
  for (const ev of events || []) {
    counts.all += 1;
    counts[myEventBucket(ev, today)] += 1;
  }
  return counts;
};

// "Active" on the dashboard = on the public calendar and not finished.
export const activeEventCount = (counts) => (counts?.now || 0) + (counts?.live || 0);

export const normaliseBucket = (value) => (MY_EVENT_BUCKET_KEYS.includes(value) ? value : 'all');
