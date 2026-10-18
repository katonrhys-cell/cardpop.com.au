import { supabase } from '@/lib/supabaseClient.js';

export const PRICE_CATEGORIES = {
  pokemon: { label: 'Pokémon', blurb: 'Vintage holos to modern chase cards — live AUD prices for the Pokémon cards Australians search for most.' },
  basketball: { label: 'Basketball (NBA)', blurb: 'Flagship Prizm and Topps rookies plus vintage grails, priced in Australian dollars.' },
  'one-piece': { label: 'One Piece', blurb: 'Alternate arts, secret rares and manga rares from the fastest-growing TCG.' },
  afl: { label: 'AFL', blurb: 'Select rookie cards of the biggest names in Australian rules football.' },
  nrl: { label: 'NRL', blurb: 'Traders rookie cards of rugby league’s modern stars.' },
};

export const CATEGORY_ORDER = ['pokemon', 'basketball', 'one-piece', 'afl', 'nrl'];

export const formatAud = (value) => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
};

/**
 * All active tracked cards with their most recent price snapshot (for the hub).
 */
export async function fetchTrackedCards(category = null) {
  let query = supabase
    .from('tracked_cards')
    .select('id, slug, name, set_name, card_number, category, blurb, card_price_snapshots(snapshot_date, raw_avg, raw_min, raw_max, raw_count, graded_avg, graded_min, graded_max, graded_count)')
    .eq('active', true)
    .order('name')
    .order('snapshot_date', { referencedTable: 'card_price_snapshots', ascending: false })
    .limit(1, { referencedTable: 'card_price_snapshots' });

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((card) => ({
    ...card,
    latest: card.card_price_snapshots?.[0] || null,
  }));
}

/**
 * A single tracked card by slug, with up to a year of snapshot history
 * (oldest → newest) for the price chart.
 */
export async function fetchCardWithHistory(slug) {
  const { data: card, error } = await supabase
    .from('tracked_cards')
    // `player` links the card to its athlete's page (/players/<slug>) when
    // tracked_cards.player_id is set — see docs/players.md.
    .select('id, slug, name, set_name, card_number, category, search_query, blurb, player:players(slug, name)')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  if (!card) return null;

  const { data: history, error: historyError } = await supabase
    .from('card_price_snapshots')
    .select('snapshot_date, raw_avg, raw_min, raw_max, raw_count, graded_avg, graded_min, graded_max, graded_count, sample_listings, exchange_rate')
    .eq('card_id', card.id)
    .order('snapshot_date', { ascending: true })
    .limit(365);
  if (historyError) throw historyError;

  return { ...card, history: history || [] };
}

/**
 * Related cards from the same category (for internal linking).
 */
export async function fetchRelatedCards(category, excludeSlug, count = 6) {
  const { data, error } = await supabase
    .from('tracked_cards')
    .select('slug, name, set_name, category')
    .eq('active', true)
    .eq('category', category)
    .neq('slug', excludeSlug)
    .limit(count);
  if (error) throw error;
  return data || [];
}
