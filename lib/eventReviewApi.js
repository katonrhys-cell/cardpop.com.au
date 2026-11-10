// Admin decisions on member events and their change requests
// (docs/event-submissions.md). Each write goes straight to Supabase under the
// admin RLS policies; the organiser's bell comes from DB triggers, and the
// email is a fire-and-forget call to the API, which sends it at most once.
import { supabase } from '@/lib/supabaseClient.js';
import { apiServerClient } from '@/lib/apiServerClient.js';

const fireAndForget = (path) => {
  apiServerClient.fetch(path, { method: 'POST' }).catch(() => {});
};

/** Email a member-submitted event's organiser that it was approved / rejected. */
export const notifyEventDecision = (eventId) => fireAndForget(`/events/${eventId}/notify-decision`);

/** Email an organiser that their change request was applied / dismissed. */
export const notifyChangeRequestDecision = (requestId) => fireAndForget(`/events/change-requests/${requestId}/notify-decision`);

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

/** Open change requests, newest first, keyed by event id. */
export async function loadPendingChangeRequests() {
  const { data, error } = await supabase
    .from('event_change_requests')
    .select('id, event_id, organiser_id, changes, created_at, updated_at')
    .eq('status', 'pending')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return new Map((data || []).map((r) => [r.event_id, r]));
}

/** Apply an open request to the live event (one transaction, in the DB). */
export async function applyChangeRequest(requestId, note) {
  const { error } = await supabase.rpc('apply_event_change_request', {
    p_request_id: requestId,
    p_review_note: note?.trim() || null,
  });
  if (error) throw error;
  notifyChangeRequestDecision(requestId);
}

/** Dismiss an open request; the live event is left as it is. */
export async function dismissChangeRequest(requestId, note) {
  const { data, error } = await supabase
    .from('event_change_requests')
    .update({ status: 'dismissed', review_note: note?.trim() || null })
    .eq('id', requestId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('No rows updated');
  notifyChangeRequestDecision(requestId);
}
