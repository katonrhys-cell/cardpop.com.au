// ─────────────────────────────────────────────────────────────────────────────
//  Card variants / foils taxonomy
//
//  Variants ("variables") describe the finish, rarity treatment, art style and
//  edition of a card. Because every game has its own foil and rarity language
//  (Pokémon Cosmos Holo vs MTG Surge Foil vs sports Prizm parallels), the lists
//  are organised per game and resolved against the selected collection so the
//  add-card forms and browse filters only ever offer variants that actually
//  exist for that card.
//
//  IMPORTANT: variant strings are persisted on vault_items.cardVariants and are
//  referenced by filters (e.g. 'Rookie Card (RC)') and badges (VARIANT_BADGES).
//  Never rename an existing string — only add new ones.
// ─────────────────────────────────────────────────────────────────────────────

export const GAME_KEYS = {
  POKEMON: 'pokemon',
  MAGIC: 'magic',
  YUGIOH: 'yugioh',
  SPORTS: 'sports',
};

// Collection / category names (and catalogue API `source` values) that map onto
// the "sports" taxonomy. Compared case-insensitively.
const SPORTS_COLLECTIONS = new Set([
  'sports', 'nba', 'nbl', 'nfl', 'mlb', 'nhl', 'afl', 'aflw', 'nrl',
  'cricket', 'soccer', 'football', 'tennis', 'golf', 'ufc', 'mma', 'boxing',
  'wrestling', 'wwe', 'formula 1', 'formula one', 'f1', 'rugby union',
  'rugby league', 'basketball', 'baseball', 'american football', 'ice hockey',
]);

/**
 * Resolve a collection name, slug or catalogue API source to one of GAME_KEYS.
 * Returns null when the input doesn't map to a game with a dedicated taxonomy
 * (callers should then fall back to the combined ALL_VARIANT_GROUPS).
 */
export function resolveGameKey(input) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  if (s.includes('pok')) return GAME_KEYS.POKEMON;                 // pokemon, pokémon, pokemon-tcg
  if (s.includes('magic') || s === 'mtg' || s.includes('gathering') || s.includes('scryfall')) return GAME_KEYS.MAGIC;
  if (s.includes('yugioh') || s.includes('yu-gi-oh') || s.includes('yu gi oh')) return GAME_KEYS.YUGIOH;
  if (SPORTS_COLLECTIONS.has(s)) return GAME_KEYS.SPORTS;
  return null;
}

// ─── Per-game variant groups ────────────────────────────────────────────────
export const GAME_VARIANT_GROUPS = {
  [GAME_KEYS.POKEMON]: [
    {
      label: 'Finish / Foil',
      variants: [
        'Base', 'Holo', 'Reverse Holo', 'Cosmos Holo', 'Cracked Ice Holo',
        'Confetti Holo', 'Saw-tooth / Tinsel Holo', 'Sheen / Leaf Holo',
        'Galaxy / Etched Holo', 'Pokéball Holo', 'Masterball Holo',
        'Textured', 'Rainbow', 'Gold', 'Silver',
      ],
    },
    {
      label: 'Rarity / Type',
      variants: [
        'Holo Rare', 'Ultra Rare', 'Illustration Rare (IR)',
        'Special Illustration Rare (SIR)', 'Hyper Rare', 'Secret Rare',
        'Amazing Rare', 'Radiant', 'Shiny / Shiny Vault', 'Trainer Gallery',
      ],
    },
    {
      label: 'Art Style',
      variants: ['Full Art', 'Alt Art', 'Extended Art', 'Character / Special Art'],
    },
    {
      label: 'Edition / Promo',
      variants: [
        '1st Edition', 'Shadowless', 'Unlimited', 'Black Star Promo',
        'Prerelease', 'Staff Promo', 'Jumbo', 'Stamped', 'Promo',
        'Error / Misprint',
      ],
    },
  ],

  [GAME_KEYS.MAGIC]: [
    {
      label: 'Finish / Foil',
      variants: [
        'Nonfoil', 'Foil', 'Etched Foil', 'Surge Foil', 'Galaxy Foil',
        'Textured Foil', 'Step-and-Compleat Foil', 'Halo Foil', 'Confetti Foil',
        'Gilded Foil', 'Oil Slick Foil', 'Raised Foil', 'Double Rainbow Foil',
        'Neon Ink', 'Manga / Ink Foil',
      ],
    },
    {
      label: 'Treatment / Art',
      variants: [
        'Borderless', 'Extended Art', 'Showcase', 'Full Art', 'Retro Frame',
        'Alt Art', 'Phyrexian', 'Serialized',
      ],
    },
    {
      label: 'Rarity',
      variants: ['Mythic Rare'],
    },
    {
      label: 'Edition / Promo',
      variants: [
        'Promo', 'Prerelease', 'Buy-a-Box', 'Promo Pack', 'Judge Promo',
        'The List / Mystery Booster', 'Error / Misprint',
      ],
    },
  ],

  [GAME_KEYS.YUGIOH]: [
    {
      label: 'Rarity / Foil',
      variants: [
        'Common', 'Rare', 'Super Rare', 'Ultra Rare', 'Secret Rare',
        'Prismatic Secret Rare', 'Ultimate Rare', 'Ghost Rare', 'Gold Rare',
        'Platinum Rare', 'Starlight Rare', "Collector's Rare",
        'Quarter Century Secret Rare', 'Parallel Rare', 'Mosaic Rare',
        'Starfoil Rare', 'Shatterfoil Rare', 'Duel Terminal',
      ],
    },
    {
      label: 'Edition / Promo',
      variants: ['1st Edition', 'Unlimited', 'Limited Edition', 'Promo', 'Error / Misprint'],
    },
  ],

  [GAME_KEYS.SPORTS]: [
    {
      // Prizm-specific colours/patterns (Silver/Gold/Black Prizm, Mojo, Hyper,
      // Cracked Ice, Wave, Shimmer, Disco, Pulsar, Fast Break) intentionally live
      // in the "Prizm Details" panel on the Add/Edit Card page rather than as
      // chips here — selecting the single "Prizm" chip reveals that panel.
      label: 'Parallel / Finish',
      variants: [
        'Base', 'Refractor', 'Prizm', 'Mosaic', 'Optic', 'Holo',
        'Velocity', 'Genesis', 'Lazer', 'Chrome', 'Rainbow', 'Gold',
        'Silver', 'Parallel',
      ],
    },
    {
      label: 'Attributes',
      variants: [
        'Rookie Card (RC)', 'Auto', 'Rookie Patch Auto (RPA)', 'Patch',
        'Relic / Jersey', 'Memorabilia', 'Numbered', '1/1', 'Short Print (SP)',
        'Booklet',
      ],
    },
    {
      label: 'Insert / Art',
      variants: ['Insert', 'Case Hit', 'Die-Cut', 'SP Photo Variation'],
    },
    {
      label: 'Edition / Promo',
      variants: ['Promo', 'Redemption', 'Error / Misprint'],
    },
  ],
};

// ─── Combined "all games" grouping ──────────────────────────────────────────
// Merges every game's groups by label, de-duplicating variants while keeping
// first-seen order. Used when no collection/game is selected and for the
// backward-compatible legacy exports below.
function mergeGroups(groupLists) {
  const byLabel = new Map();
  for (const groups of groupLists) {
    for (const group of groups) {
      if (!byLabel.has(group.label)) byLabel.set(group.label, []);
      const arr = byLabel.get(group.label);
      for (const variant of group.variants) {
        if (!arr.includes(variant)) arr.push(variant);
      }
    }
  }
  return Array.from(byLabel, ([label, variants]) => ({ label, variants }));
}

export const ALL_VARIANT_GROUPS = mergeGroups(Object.values(GAME_VARIANT_GROUPS));

/**
 * Variant groups for a given collection/game. Falls back to the combined list
 * when the collection has no dedicated taxonomy (or none is selected yet).
 */
export function getVariantGroups(gameOrCollection) {
  const key = resolveGameKey(gameOrCollection);
  return key ? GAME_VARIANT_GROUPS[key] : ALL_VARIANT_GROUPS;
}

/** Flat list of variant strings for a given collection/game. */
export function getCardVariants(gameOrCollection) {
  return getVariantGroups(gameOrCollection).flatMap(g => g.variants);
}

// ─── Legacy exports (backward compatible) ───────────────────────────────────
// VARIANT_GROUPS / CARD_VARIANTS now represent the union across all games so
// existing consumers that don't pass a collection keep working unchanged.
export const VARIANT_GROUPS = ALL_VARIANT_GROUPS;
export const CARD_VARIANTS = ALL_VARIANT_GROUPS.flatMap(g => g.variants);

// Variants that render a special overlay badge on card images, plus card border styling
export const VARIANT_BADGES = {
  'Rookie Card (RC)': {
    label: 'RC',
    bg: 'bg-amber-400', text: 'text-amber-900',
    border: 'border-2 border-amber-400',
    glow: 'shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_4px_20px_rgba(251,191,36,0.25)]',
  },
  'Auto': {
    label: 'AUTO',
    bg: 'bg-blue-500', text: 'text-white',
    border: 'border-2 border-blue-500',
    glow: 'shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_4px_20px_rgba(59,130,246,0.25)]',
  },
  '1st Edition': {
    label: '1st Ed',
    bg: 'bg-violet-600', text: 'text-white',
    border: 'border-2 border-violet-600',
    glow: 'shadow-[0_0_0_1px_rgba(124,58,237,0.35),0_4px_20px_rgba(124,58,237,0.25)]',
  },
};
