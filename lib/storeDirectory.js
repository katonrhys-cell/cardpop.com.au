import { supabase } from '@/lib/supabaseClient.js';
import { toLocalDateStr } from '@/lib/eventSeo.js';

export const DIRECTORY_CITIES = {
  sydney:           { label: 'Sydney',         state: 'NSW' },
  newcastle:        { label: 'Newcastle',      state: 'NSW' },
  wollongong:       { label: 'Wollongong',     state: 'NSW' },
  'central-coast':  { label: 'Central Coast',  state: 'NSW' },
  canberra:         { label: 'Canberra',       state: 'ACT' },
  melbourne:        { label: 'Melbourne',      state: 'VIC' },
  geelong:          { label: 'Geelong',        state: 'VIC' },
  ballarat:         { label: 'Ballarat',       state: 'VIC' },
  bendigo:          { label: 'Bendigo',        state: 'VIC' },
  adelaide:         { label: 'Adelaide',       state: 'SA' },
  hobart:           { label: 'Hobart',         state: 'TAS' },
  launceston:       { label: 'Launceston',     state: 'TAS' },
  brisbane:         { label: 'Brisbane',       state: 'QLD' },
  'gold-coast':     { label: 'Gold Coast',     state: 'QLD' },
  'sunshine-coast': { label: 'Sunshine Coast', state: 'QLD' },
  cairns:           { label: 'Cairns',         state: 'QLD' },
  townsville:       { label: 'Townsville',     state: 'QLD' },
  toowoomba:        { label: 'Toowoomba',      state: 'QLD' },
  perth:            { label: 'Perth',          state: 'WA' },
  darwin:           { label: 'Darwin',         state: 'NT' },
};

export const STORE_CATEGORY_LABELS = {
  pokemon: 'Pokémon',
  tcg: 'TCG (MTG, One Piece, Yu-Gi-Oh…)',
  sports: 'Sports cards',
  collectibles: 'Collectibles & graded cards',
};

/**
 * Approved stores, optionally for one city, ordered by name.
 */
export async function fetchStores(city = null) {
  let query = supabase
    .from('local_game_stores')
    .select('slug, name, suburb, city, state, website, categories, description')
    .eq('status', 'approved')
    .order('name');
  if (city) query = query.eq('city', city);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Upcoming approved events in a state (shown on the matching city pages).
 */
export async function fetchUpcomingEventsByState(state, count = 6) {
  // Local date, not UTC: toISOString() is yesterday for AU users until ~10-11am.
  const today = toLocalDateStr(new Date());
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, title, start_date, venue_name, suburb, state, event_type')
    .eq('status', 'approved')
    .eq('state', state)
    .gte('start_date', today)
    .order('start_date', { ascending: true })
    .limit(count);
  if (error) throw error;
  return data || [];
}
