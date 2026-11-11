import { supabase } from '@/lib/supabaseClient.js';
import { todayInAustralia } from '@/utils/featuredPackages.js';

// Event page views — docs/event-views.md. A view is recorded by the
// record_event_view() RPC (which ignores non-public events and the organiser's /
// admins' own visits); an organiser reads their events' totals through
// event_view_stats(), which re-checks ownership in the database.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|prerender/i;
const KEY = (id) => `cp:event-view:${id}`;

/** True for browsers that shouldn't add to a popularity count (automation, crawlers). */
export function looksAutomated(nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!nav) return true;
  return Boolean(nav.webdriver) || BOT_RE.test(String(nav.userAgent || ''));
}

/**
 * Record one view of an event, at most once per browser per event per
 * (Australian) day. Never throws: a counter must not break the page.
 * Returns true when a view was sent.
 */
export async function recordEventView(eventId, { storage, nav, now } = {}) {
  try {
    if (!UUID_RE.test(String(eventId ?? ''))) return false;   // legacy static events have no row
    if (looksAutomated(nav)) return false;
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const today = todayInAustralia(now);
    try {
      if (store?.getItem(KEY(eventId)) === today) return false;
      // Mark first so two effects firing together (StrictMode, a modal re-open)
      // send one view; undone below if the call fails.
      store?.setItem(KEY(eventId), today);
    } catch { /* storage blocked — count it; the DB still only increments by one */ }
    const forget = () => { try { store?.removeItem?.(KEY(eventId)); } catch { /* ignore */ } };
    try {
      const { error } = await supabase.rpc('record_event_view', { p_event_id: eventId });
      if (error) { forget(); return false; }
      return true;
    } catch {
      forget();   // a failed send mustn't use up today's slot — the next visit retries
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Totals for the caller's own events: { [eventId]: { total, last7, last30 } }.
 * Events with no views yet are simply absent. Resolves {} on any failure.
 */
export async function fetchEventViewStats(eventIds) {
  const ids = [...new Set((eventIds || []).filter((id) => UUID_RE.test(String(id))))].slice(0, 200);
  if (ids.length === 0) return {};
  try {
    const { data, error } = await supabase.rpc('event_view_stats', { p_event_ids: ids });
    if (error || !Array.isArray(data)) return {};
    return Object.fromEntries(data.map((r) => [r.event_id, {
      total: Number(r.total) || 0,
      last7: Number(r.last_7) || 0,
      last30: Number(r.last_30) || 0,
    }]));
  } catch {
    return {};
  }
}

/** "1,234 views" / "1 view". */
export function formatViews(n) {
  const v = Number(n) || 0;
  return `${v.toLocaleString('en-AU')} ${v === 1 ? 'view' : 'views'}`;
}
