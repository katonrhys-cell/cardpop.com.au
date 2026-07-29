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

// The single source of truth for the rookie designation. Selecting this chip in
// the Card Variant / Finish section drives everything rookie-related: the
// is_rookie flag saved for filters, the rookie details panel on the add/edit
// form, and the one <RookiePill /> shown under card tiles.
export const ROOKIE_VARIANT = 'Rookie Card (RC)';

// A rookie card that also carries an autograph and a memorabilia patch. It is a
// *kind* of rookie card, not an alternative to one, so selecting it always
// implies ROOKIE_VARIANT as well — otherwise an RPA would miss the is_rookie
// flag, the rookie panel and the pill, all of which hang off that chip alone.
export const ROOKIE_PATCH_AUTO_VARIANT = 'Rookie Patch Auto (RPA)';

/**
 * Adds the rookie chip(s) an identification found to whatever the seller has
 * already selected.
 *
 * Additive by design: an identification may tell us a card *is* a rookie, but
 * never that the seller's other selections are wrong, so nothing is removed and
 * nothing is duplicated. An unrecognised value is ignored rather than added as a
 * free-text chip.
 *
 * @param {string[]} variants - the seller's current selection
 * @param {string|null|undefined} rookie - the identified designation
 * @returns {string[]} a new array
 */
export function mergeRookieVariant(variants, rookie) {
  const current = Array.isArray(variants) ? variants : [];
  const normalised = String(rookie ?? '').trim().toLowerCase();

  const additions = [];
  if (normalised === ROOKIE_PATCH_AUTO_VARIANT.toLowerCase() || normalised === 'rpa') {
    additions.push(ROOKIE_VARIANT, ROOKIE_PATCH_AUTO_VARIANT);
  } else if (normalised === ROOKIE_VARIANT.toLowerCase() || normalised === 'rc') {
    additions.push(ROOKIE_VARIANT);
  }

  const missing = additions.filter(v => !current.includes(v));
  return missing.length ? [...current, ...missing] : current;
}

// What a vision model tends to call a treatment, mapped to the chip that means
// it. Only the wording differs — each target must still exist in the selected
// collection's taxonomy to be used, so this can widen recognition without ever
// introducing a chip that game doesn't have.
const VARIANT_SYNONYMS = {
  autograph: 'Auto', signature: 'Auto', signed: 'Auto',
  'on-card autograph': 'Auto', 'sticker autograph': 'Auto', 'on card auto': 'Auto',
  jersey: 'Relic / Jersey', relic: 'Relic / Jersey', 'game worn': 'Relic / Jersey',
  'game-worn': 'Relic / Jersey', 'player worn': 'Relic / Jersey',
  'serial numbered': 'Numbered', serialised: 'Numbered', serialized: 'Numbered',
  'one of one': '1/1', 'one-of-one': '1/1',
  'short print': 'Short Print (SP)', sp: 'Short Print (SP)',
  'die cut': 'Die-Cut', diecut: 'Die-Cut',
  holographic: 'Holo', holofoil: 'Holo',
  'first edition': '1st Edition',
  'alternate art': 'Alt Art', 'alternative art': 'Alt Art',
  'reverse holofoil': 'Reverse Holo',
  misprint: 'Error / Misprint', error: 'Error / Misprint',
};

/**
 * Resolves free-text treatments read off a card to the variant chips that exist
 * for that collection.
 *
 * The taxonomy is per-game and its strings are persisted and referenced by
 * filters and badges, so an identification is never allowed to introduce one.
 * Anything that doesn't resolve to a real chip for this collection is dropped —
 * a Pokemon card cannot acquire "Refractor", and a misread word becomes nothing
 * rather than a junk chip on a live listing.
 *
 * @param {string[]|null|undefined} attributes - treatments as read off the card
 * @param {string} collection - collection/game name, for the taxonomy
 * @returns {string[]} canonical chip names, de-duplicated
 */
export function resolveVariantChips(attributes, collection) {
  const allowed = new Map(getCardVariants(collection).map(v => [v.toLowerCase(), v]));
  const resolved = [];

  for (const raw of Array.isArray(attributes) ? attributes : []) {
    const key = String(raw ?? '').trim().toLowerCase();
    if (!key) continue;
    const synonym = VARIANT_SYNONYMS[key];
    const chip = allowed.get(key) ?? (synonym ? allowed.get(synonym.toLowerCase()) : undefined);
    if (chip && !resolved.includes(chip)) resolved.push(chip);
  }

  return resolved;
}

// Finishes that mean the card is foiled, for the dedicated isFoil flag. "Base"
// and "Nonfoil" are explicitly not — and "Nonfoil" contains "foil", so a naive
// substring test gets it backwards.
const NOT_FOIL = new Set(['base', 'nonfoil']);
const FOIL_PATTERN = /foil|holo|refractor|prizm|chrome|rainbow|prismatic|mosaic|optic|shatterfoil|starfoil/i;

/** Whether any resolved chip means the card has a foil/holo finish. */
export function impliesFoil(chips) {
  return (chips ?? []).some(c => !NOT_FOIL.has(String(c).toLowerCase()) && FOIL_PATTERN.test(c));
}

/**
 * Everything an identification can contribute to the variant chips: the rookie
 * designation, the treatments read off the card, and "Numbered" implied by a
 * printed serial.
 *
 * Additive, like `mergeRookieVariant` — identification can tell us what a card
 * IS, never that the seller's own selections are wrong.
 *
 * @param {string[]} variants - the seller's current selection
 * @param {{rookie?: string, attributes?: string[], serialNumber?: string}} identified
 * @param {string} collection
 * @returns {string[]}
 */
export function mergeIdentifiedVariants(variants, identified = {}, collection) {
  const withRookie = mergeRookieVariant(variants, identified.rookie);

  const attributes = [...(identified.attributes ?? [])];
  // A printed serial ("23/99") is itself proof the card is numbered.
  if (String(identified.serialNumber ?? '').trim()) attributes.push('Numbered');

  const chips = resolveVariantChips(attributes, collection);
  const missing = chips.filter(v => !withRookie.includes(v));
  return missing.length ? [...withRookie, ...missing] : withRookie;
}

// Variants that render a special overlay badge on card images, plus card border styling.
// `overlay: false` keeps the border/glow but suppresses the image overlay badge —
// the rookie designation is shown once, as the pill under the card, not on the image.
export const VARIANT_BADGES = {
  [ROOKIE_VARIANT]: {
    label: 'RC',
    bg: 'bg-amber-400', text: 'text-amber-900',
    border: 'border-2 border-amber-400',
    glow: 'shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_4px_20px_rgba(251,191,36,0.25)]',
    overlay: false,
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
