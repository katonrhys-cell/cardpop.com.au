// Admin side of member events (docs/event-submissions.md): deciding
// submissions, and reading organisers' edits to live events. Writes go
// straight to Supabase under the admin RLS policies; the organiser's bell
// comes from DB triggers, and the email is a fire-and-forget call to the API,
// which sends it at most once.
import { supabase } from '@/lib/supabaseClient.js';
import { apiServerClient } from '@/lib/apiServerClient.js';

const fireAndForget = (path) => {
  apiServerClient.fetch(path, { method: 'POST' }).catch(() => {});
};

/** Email a member-submitted event's organiser that it was approved / rejected. */
export const notifyEventDecision = (eventId) => fireAndForget(`/events/${eventId}/notify-decision`);

/** Email every admin what the organiser just changed on their live event. */
export const notifyEventChanges = (eventId) => fireAndForget(`/events/${eventId}/notify-changes`);

/** Reject a pending submission with a reason the organiser sees. */
export async function rejectEvent(eventId, reason) {
  const { data, error } = await supabase
    .from('events')
    .update({ status: 'rejected', rejection_reason: reason?.trim() || null })
    .eq('id', eventId)
    .select('id');
  if (error) throw error;
  // RLS answers a forbidden update with zero rows and no error.
  if (!data?.length) throw new Error('No rows updated');
  notifyEventDecision(eventId);
}

const LOG_COLUMNS = 'id, event_id, changed_by, changes, created_at, reviewed_at, reviewed_by';

/** Organiser edits an admin hasn't marked reviewed yet, as Map(event_id → entries newest first). */
export async function loadUnreviewedChanges() {
  const { data, error } = await supabase
    .from('event_change_log')
    .select(LOG_COLUMNS)
    .is('reviewed_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const byEvent = new Map();
  for (const row of data || []) {
    if (!byEvent.has(row.event_id)) byEvent.set(row.event_id, []);
    byEvent.get(row.event_id).push(row);
  }
  return byEvent;
}

/** An event's change history (newest first) with each editor's name. */
export async function loadEventChangeLog(eventId, limit = 30) {
  const { data, error } = await supabase
    .from('event_change_log')
    .select(LOG_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const ids = [...new Set((data || []).map((r) => r.changed_by).filter(Boolean))];
  let names = {};
  if (ids.length) {
    const { data: people } = await supabase.from('profiles').select('id, display_name, username').in('id', ids);
    names = Object.fromEntries((people || []).map((p) => [p.id, p.display_name || p.username || null]));
  }
  return (data || []).map((r) => ({ ...r, changed_by_name: names[r.changed_by] || null }));
}

/** Mark every unreviewed edit on an event as reviewed (the DB records which admin). */
export async function markEventChangesReviewed(eventId) {
  const { error } = await supabase
    .from('event_change_log')
    .update({ reviewed_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .is('reviewed_at', null);
  if (error) throw error;
}
