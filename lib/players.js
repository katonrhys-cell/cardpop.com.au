// Supabase reads for the player pages and the Player picker. The pure helpers
// (matching, slugs, paths) live in utils/players.js so the prerenderer and the
// sitemap can share them without pulling in the client.
import { supabase } from '@/lib/supabaseClient.js';
import { LISTING_CARD_COLUMNS, LISTING_SELLER_EMBED } from '@/lib/listingColumns.js';
import { LISTING_CARD_VAULT_EMBED_INNER } from '@/lib/listingCardColumns.js';

// What the picker, the index page, search results and the product-page chip
// render. `bio` and `collecting_notes` are long and belong to the page only.
export const PLAYER_CARD_COLUMNS = [
  'id', 'slug', 'name', 'sport', 'team', 'position', 'nationality',
  'headline', 'aliases', 'image_url', 'sort_order', 'is_published',
].join(',');

export const PLAYER_PAGE_COLUMNS = `${PLAYER_CARD_COLUMNS},born_on,born_year,career_span,bio,collecting_notes,key_cards,created_at,updated_at`;

// The hobby has a few hundred collected athletes at most, so the list is read
// once and matched in the browser (utils/players.js) rather than per keystroke.
export const PLAYERS_LIST_LIMIT = 500;

/** Every published player in display order (sort_order, then name). */
export async function fetchPublishedPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select(PLAYER_CARD_COLUMNS)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(PLAYERS_LIST_LIMIT);
  if (error) throw error;
  return data || [];
}

/** One player by slug, published only (RLS also lets admins see drafts). */
export async function fetchPlayerBySlug(slug) {
  if (!slug) return null;
  const { data, error } = await supabase
    .from('players')
    .select(PLAYER_PAGE_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** The small card the product page's chip needs, by id. */
export async function fetchPlayerById(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('players')
    .select('id, slug, name, sport, image_url')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Live (and recently sold) marketplace listings of cards tagged with this
 * player. The vault embed is `!inner`, so the player filter on the embedded
 * row constrains the listings; visibility is the card's own RLS.
 */
export async function fetchPlayerListings(playerId, { limit = 24, includeSold = true } = {}) {
  if (!playerId) return [];
  const statuses = includeSold ? ['active', 'sold'] : ['active'];
  const { data, error } = await supabase
    .from('listings')
    .select(`${LISTING_CARD_COLUMNS}, ${LISTING_CARD_VAULT_EMBED_INNER}, ${LISTING_SELLER_EMBED}`)
    .eq('vault_item.player_id', playerId)
    .in('status', statuses)
    .neq('listing_type', 'vault')
    .order('status', { ascending: true }) // active before sold
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/**
 * The price-tracker cards linked to this player, each with its latest snapshot
 * (for the stat tiles) and up to a year of history (for the chart).
 */
export async function fetchPlayerTrackedCards(playerId, { historyDays = 365 } = {}) {
  if (!playerId) return [];
  const { data: cards, error } = await supabase
    .from('tracked_cards')
    .select('id, slug, name, set_name, card_number, category, blurb, image_url')
    .eq('player_id', playerId)
    .eq('active', true)
    .order('name')
    .limit(12);
  if (error) throw error;
  if (!cards?.length) return [];

  const since = new Date(Date.now() - historyDays * 86400000).toISOString().slice(0, 10);
  const { data: snaps, error: snapError } = await supabase
    .from('card_price_snapshots')
    .select('card_id, snapshot_date, raw_avg, raw_min, raw_max, raw_count, graded_avg, graded_min, graded_max, graded_count')
    .in('card_id', cards.map((c) => c.id))
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })
    .limit(historyDays * cards.length);
  if (snapError) throw snapError;

  const byCard = new Map(cards.map((c) => [c.id, []]));
  for (const s of snaps || []) byCard.get(s.card_id)?.push(s);
  return cards.map((c) => {
    const history = byCard.get(c.id) || [];
    return { ...c, history, latest: history[history.length - 1] || null };
  });
}
