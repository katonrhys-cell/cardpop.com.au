import { supabase } from '@/lib/supabaseClient.js';

/**
 * Accent presets for hero showcase cards.
 *
 * The animated showcase renders a gradient "slab" behind each card image plus a
 * coloured edge. Admins pick one of these named accents per card instead of
 * dealing with raw Tailwind classes. `swatch` is only used by the admin UI to
 * preview the choice.
 */
export const SHOWCASE_ACCENTS = {
  gold:   { label: 'Gold',   gradient: 'from-stone-800 via-stone-900 to-black',        border: 'border-yellow-600/60',  swatch: '#ca8a04' },
  red:    { label: 'Red',    gradient: 'from-red-800 via-red-900 to-black',            border: 'border-red-400/50',     swatch: '#dc2626' },
  blue:   { label: 'Blue',   gradient: 'from-blue-800 via-blue-900 to-red-900',        border: 'border-blue-300/50',    swatch: '#2563eb' },
  purple: { label: 'Purple', gradient: 'from-purple-800 via-purple-900 to-black',      border: 'border-purple-400/50',  swatch: '#7c3aed' },
  amber:  { label: 'Amber',  gradient: 'from-yellow-400 via-yellow-500 to-amber-500',  border: 'border-yellow-200/70',  swatch: '#f59e0b' },
  green:  { label: 'Green',  gradient: 'from-emerald-800 via-emerald-900 to-black',    border: 'border-emerald-400/50', swatch: '#059669' },
  slate:  { label: 'Slate',  gradient: 'from-zinc-700 via-zinc-800 to-black',          border: 'border-zinc-400/40',    swatch: '#71717a' },
};

export const DEFAULT_ACCENT = 'gold';

/**
 * Map a `hero_showcase_cards` row to the shape the <HeroCardShowcase> component
 * expects (it was originally written against the hard-coded HERO_CARDS array).
 */
export const mapShowcaseRow = (row) => {
  const accent = SHOWCASE_ACCENTS[row.accent] || SHOWCASE_ACCENTS[DEFAULT_ACCENT];
  return {
    id: row.id,
    image: row.image_url,
    gradient: accent.gradient,
    borderColor: accent.border,
    name: row.name,
    set: row.subtitle || '',
    rarity: row.rarity || '',
    value: row.value || '',
  };
};

/**
 * Fetch the active showcase cards for the public homepage, ordered for display.
 * Returns [] on error or when nothing is configured so callers can fall back to
 * their built-in defaults.
 */
export const fetchActiveShowcaseCards = async () => {
  try {
    const { data, error } = await supabase
      .from('hero_showcase_cards')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapShowcaseRow);
  } catch (err) {
    console.error('Failed to fetch hero showcase cards:', err);
    return [];
  }
};
