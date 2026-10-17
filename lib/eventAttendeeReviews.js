import { supabase } from '@/lib/supabaseClient.js';

// Collector reviews of past events (table event_attendee_reviews, migration
// 20261017044544_past_events_and_attendee_reviews.sql). Hidden rows are
// filtered here as well as by RLS so an admin's own list matches the public one.

export const REVIEW_COLUMNS =
  'id, event_id, reviewer_id, reviewer_name, rating, title, body, created_at, updated_at, ' +
  'profiles:reviewer_id(id, display_name, username, avatar_url, profile_photo_or_character)';

export const MAX_REVIEWS = 100;

export const fetchEventReviews = async (eventId) => {
  const { data, error } = await supabase
    .from('event_attendee_reviews')
    .select(REVIEW_COLUMNS)
    .eq('event_id', eventId)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(MAX_REVIEWS);
  if (error) throw error;
  return data || [];
};

// { [eventId]: { review_count, average_rating } } for a list of events — one
// request for a whole grid, from the per-event stats view.
export const fetchReviewStatsMap = async (eventIds) => {
  const ids = (eventIds || []).filter(Boolean);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('event_attendee_review_stats')
    .select('event_id, review_count, average_rating')
    .in('event_id', ids);
  if (error) throw error;
  const map = {};
  for (const row of data || []) map[row.event_id] = row;
  return map;
};

export const submitEventReview = async ({ eventId, userId, rating, title, body }) => {
  const { data, error } = await supabase
    .from('event_attendee_reviews')
    .insert({ event_id: eventId, reviewer_id: userId, rating, title: title || null, body })
    .select(REVIEW_COLUMNS)
    .single();
  if (error) throw error;
  return data;
};

export const updateEventReview = async (id, { rating, title, body }) => {
  const { data, error } = await supabase
    .from('event_attendee_reviews')
    .update({ rating, title: title || null, body })
    .eq('id', id)
    .select(REVIEW_COLUMNS)
    .single();
  if (error) throw error;
  return data;
};

export const deleteEventReview = async (id) => {
  const { error } = await supabase.from('event_attendee_reviews').delete().eq('id', id);
  if (error) throw error;
};

// Admin only (RLS): the row stays for its author, leaves the public list and the stats.
export const hideEventReview = async (id) => {
  const { data, error } = await supabase
    .from('event_attendee_reviews')
    .update({ is_visible: false })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Not allowed');
};
