// Helpers for reading and writing event RSVPs. Users RSVP to an event as a
// "buyer" (attendee) or a "vendor". Backed by the public.event_rsvps table and
// the public.event_rsvp_counts view (see supabase/migrations).
import { supabase } from '@/lib/supabaseClient.js';

export const RSVP_ROLES = {
  buyer: { value: 'buyer', label: 'Buyer', plural: 'Attendees' },
  vendor: { value: 'vendor', label: 'Vendor', plural: 'Vendors' },
};

const emptyCounts = () => ({ buyer: 0, vendor: 0 });

// Fetch buyer/vendor counts for one or more events.
// Returns a map keyed by event_id: { [id]: { buyer, vendor } }.
export const fetchRsvpCounts = async (eventIds = []) => {
  const ids = [...new Set(eventIds.filter(Boolean))];
  if (ids.length === 0) return {};
  // Counts come from a SECURITY DEFINER function (not a table/view): it totals
  // all RSVPs while the raw event_rsvps rows stay hidden by RLS.
  const { data, error } = await supabase.rpc('get_event_rsvp_counts', { event_ids: ids });
  if (error) throw error;
  const map = {};
  (data || []).forEach((row) => {
    map[row.event_id] = {
      buyer: row.buyer_count || 0,
      vendor: row.vendor_count || 0,
    };
  });
  return map;
};

// Fetch the current user's RSVP role for the given events.
// Returns a map keyed by event_id: { [id]: 'buyer' | 'vendor' }.
export const fetchMyRsvps = async (userId, eventIds = []) => {
  const ids = [...new Set(eventIds.filter(Boolean))];
  if (!userId || ids.length === 0) return {};
  const { data, error } = await supabase
    .from('event_rsvps')
    .select('event_id, role')
    .eq('user_id', userId)
    .in('event_id', ids);
  if (error) throw error;
  const map = {};
  (data || []).forEach((row) => { map[row.event_id] = row.role; });
  return map;
};

// Fetch the approved events a given user has RSVP'd to, each annotated with the
// capacity they're attending in (`rsvpRole`: 'buyer' or 'vendor'). Used to show
// a collector's upcoming shows on their public profile.
//
// The raw event_rsvps rows are hidden by RLS (owner/admin only), so the list of
// events a *given* user is attending comes from the SECURITY DEFINER function
// get_user_event_rsvps, which returns only approved events (never pending or
// rejected ones). Event details are then read from the public events_public view.
export const fetchUserEvents = async (userId) => {
  if (!userId) return [];
  const { data: rsvps, error } = await supabase.rpc('get_user_event_rsvps', { profile_id: userId });
  if (error) throw error;
  const roleById = {};
  (rsvps || []).forEach((row) => { roleById[row.event_id] = row.role; });
  const ids = Object.keys(roleById);
  if (ids.length === 0) return [];

  const { data: events, error: eventsError } = await supabase
    .from('events_public')
    .select('*')
    .in('id', ids);
  if (eventsError) throw eventsError;

  return (events || [])
    .map((event) => ({ ...event, rsvpRole: roleById[event.id] }))
    .sort((a, b) => new Date(a.start_date || 0) - new Date(b.start_date || 0));
};

// Create or change the current user's RSVP for an event.
export const setRsvp = async (eventId, userId, role) => {
  if (!eventId || !userId) throw new Error('Missing event or user');
  if (!RSVP_ROLES[role]) throw new Error(`Invalid RSVP role: ${role}`);
  const { error } = await supabase
    .from('event_rsvps')
    .upsert(
      { event_id: eventId, user_id: userId, role, updated_at: new Date().toISOString() },
      { onConflict: 'event_id,user_id' },
    );
  if (error) throw error;
};

// Cancel the current user's RSVP for an event.
export const removeRsvp = async (eventId, userId) => {
  if (!eventId || !userId) throw new Error('Missing event or user');
  const { error } = await supabase
    .from('event_rsvps')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
};

export { emptyCounts };
