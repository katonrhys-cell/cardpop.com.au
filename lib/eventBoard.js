// Helpers for the per-event information board (announcements, stall layout,
// stalls) and event-linked forum discussions. Backed by event_board_posts,
// event_stall_layouts, event_stalls and the posts.event_id column — see
// supabase/migrations/20260820081848_event_forums_and_info_board.sql.
import { supabase } from '@/lib/supabaseClient.js';

// Badge labels for the roles get_event_participant_roles can return.
export const EVENT_ROLE_LABELS = {
  organiser: 'Organiser',
  vendor: 'Vendor',
};

// Whether the current user may post announcements / edit the stall layout for
// this event (admin, the event's organiser, or a vendor RSVP'd to it). The
// check lives in a SECURITY DEFINER function because organiser_id and raw
// RSVP rows are hidden from clients by RLS.
export const fetchCanManageBoard = async (eventId) => {
  if (!eventId) return false;
  const { data, error } = await supabase.rpc('can_manage_event_board', { p_event_id: eventId });
  if (error) throw error;
  return data === true;
};

// Organiser/vendor badges for the given users on one event.
// Returns a map: { [userId]: 'organiser' | 'vendor' }. 'organiser' wins when
// a user is both.
export const fetchParticipantRoles = async (eventId, userIds = []) => {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!eventId || ids.length === 0) return {};
  const { data, error } = await supabase.rpc('get_event_participant_roles', {
    p_event_id: eventId,
    p_user_ids: ids,
  });
  if (error) throw error;
  const map = {};
  (data || []).forEach((row) => {
    if (map[row.user_id] !== 'organiser') map[row.user_id] = row.role;
  });
  return map;
};

// Pinned announcements first, newest first within each group.
export const sortBoardPosts = (posts = []) =>
  [...posts].sort((a, b) => {
    if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

// Stalls in display order: sort_order, then a natural compare on the label so
// "Stall 2" sorts before "Stall 10".
export const sortStalls = (stalls = []) =>
  [...stalls].sort((a, b) => {
    if ((a.sort_order || 0) !== (b.sort_order || 0)) return (a.sort_order || 0) - (b.sort_order || 0);
    return String(a.label || '').localeCompare(String(b.label || ''), undefined, { numeric: true });
  });

// Clamp a marker coordinate to the 0-100 range the schema enforces (values are
// percentages across the layout image). Returns null for blank/invalid input
// so unplaced stalls stay unplaced.
export const clampStallPosition = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, num));
};
