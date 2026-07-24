import { supabase } from '@/lib/supabaseClient.js';
import { VAULT_ITEM_CARD_SELECT } from '@/lib/listingCardColumns.js';

/**
 * Admin-curated cards for the per-collection card strips.
 *
 * Each collection page (Pokémon, Magic, NBA, …) renders several card sections.
 * Historically every section was auto-populated by a query (recency / price /
 * grade). Admins can now "pin" specific marketplace cards to a section via
 * /admin/collection-sections. Pinned cards render first, in the chosen order,
 * and the remaining slots auto-fill with the original query (deduped).
 */

export const COLLECTION_SECTIONS = [
  { key: 'new_releases', label: 'New Releases' },
  { key: 'graded',       label: 'Graded / All Star Slabs' },
  { key: 'trending',     label: 'Trending Now' },
  { key: 'holy_grail',   label: 'Legendary / Holy Grail Picks' },
];

export const SECTION_LABELS = Object.fromEntries(
  COLLECTION_SECTIONS.map((s) => [s.key, s.label]),
);

/**
 * Fetch the admin-pinned vault items for a collection section, in display order.
 * Returns [] (and never throws) so callers can always fall back to auto results.
 *
 * @param {string} slug          collection slug (e.g. 'pokemon')
 * @param {string} section       one of COLLECTION_SECTIONS keys
 * @param {string} selectClause  vault_items select clause (override to add joins)
 */
export const fetchPinnedSectionItems = async (
  slug,
  section,
  selectClause = VAULT_ITEM_CARD_SELECT,
) => {
  if (!slug) return [];
  try {
    const { data: pins, error } = await supabase
      .from('collection_section_cards')
      .select('vault_item_id, sort_order')
      .eq('collection_slug', slug)
      .eq('section', section)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    const ids = (pins ?? []).map((p) => p.vault_item_id);
    if (ids.length === 0) return [];

    const { data: items, error: itemsErr } = await supabase
      .from('vault_items')
      .select(selectClause)
      .in('id', ids);
    if (itemsErr) throw itemsErr;

    // Preserve the admin's order; drop any pins whose card was deleted.
    const byId = new Map((items ?? []).map((it) => [it.id, it]));
    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((i) => ({ ...i, source: 'vault', pinned: true }));
  } catch (err) {
    console.warn('[collectionSections] pinned fetch failed:', err);
    return [];
  }
};

/**
 * Merge pinned items ahead of auto-query results, de-duplicated by id and
 * capped at `limit`.
 */
export const mergePinned = (pinned, auto, limit) => {
  const seen = new Set(pinned.map((p) => p.id));
  const merged = [...pinned];
  for (const item of auto) {
    if (merged.length >= limit) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged.slice(0, limit);
};
