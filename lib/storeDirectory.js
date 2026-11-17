import { supabase } from '@/lib/supabaseClient.js';
import { toLocalDateStr } from '@/lib/eventSeo.js';
import { STORE_LIST_COLUMNS, STORE_PAGE_COLUMNS, sortStoresFeaturedFirst } from '@/utils/storePage.js';

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
 * Approved stores, optionally for one city: featured shops (an Ultimate
 * member's — `membership_featured`) first, then by name.
 */
export async function fetchStores(city = null) {
  // The featured flag arrives with its own migration; without it the list is
  // read exactly as before.
  let featuredQuery = supabase
    .from('local_game_stores')
    .select(`${STORE_LIST_COLUMNS}, membership_featured`)
    .eq('status', 'approved')
    .order('name');
  if (city) featuredQuery = featuredQuery.eq('city', city);
  const featured = await featuredQuery;
  if (!featured.error) return sortStoresFeaturedFirst(featured.data);

  let query = supabase
    .from('local_game_stores')
    .select(STORE_LIST_COLUMNS)
    .eq('status', 'approved')
    .order('name');
  if (city) query = query.eq('city', city);
  let { data, error } = await query;
  // The `photos` column arrives with the store-pages migration; until it has
  // landed the directory still lists every store, just without a thumbnail.
  if (error && /photos|logo_url/i.test(error.message || '')) {
    let fallback = supabase
      .from('local_game_stores')
      .select('slug, name, suburb, city, state, website, categories, description')
      .eq('status', 'approved')
      .order('name');
    if (city) fallback = fallback.eq('city', city);
    ({ data, error } = await fallback);
  }
  if (error) throw error;
  return data || [];
}

/**
 * One store's own page (/card-shops/<city>/<slug>). Approved stores for the
 * public; RLS also lets an admin preview a pending one. Null when not found.
 */
export async function fetchStore(slug) {
  if (!slug) return null;
  const { data, error } = await supabase
    .from('local_game_stores')
    .select(STORE_PAGE_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data || null;
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

/**
 * Every approved store with its id and whether it already has an owner — the
 * "Your shop" dropdown on the shop-owner application. Falls back to no owner
 * information if the ownership migration hasn't landed (the API still refuses
 * a shop that has one).
 */
export async function fetchClaimableStores() {
  const base = 'id, slug, name, suburb, city, state';
  let { data, error } = await supabase
    .from('local_game_stores').select(`${base}, owner_id`).eq('status', 'approved').order('name');
  if (error) {
    ({ data, error } = await supabase
      .from('local_game_stores').select(base).eq('status', 'approved').order('name'));
  }
  if (error) throw error;
  return data || [];
}

/**
 * Who owns a store's page and whether it is featured: `{ ownerId, featured }`.
 * `ownerId` is a user id, null (no owner yet) or undefined (not known). Read
 * separately from the page itself so the page never depends on these columns.
 */
export async function fetchStoreStanding(slug) {
  if (!slug) return { ownerId: undefined, featured: false };
  let { data, error } = await supabase
    .from('local_game_stores').select('owner_id, membership_featured').eq('slug', slug).maybeSingle();
  if (error) {
    ({ data, error } = await supabase
      .from('local_game_stores').select('owner_id').eq('slug', slug).maybeSingle());
  }
  if (error) return { ownerId: undefined, featured: false };
  return { ownerId: data?.owner_id ?? null, featured: Boolean(data?.membership_featured) };
}
