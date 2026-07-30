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
//
//  Two levels: the *chips* the Card Variant / Finish box shows
//  (GAME_VARIANT_GROUPS) and the named foil/holo finishes behind the single
//  FOIL_VARIANT chip (GAME_FOIL_FINISHES), which the Add/Edit form shows in a
//  Foil / Holo Details panel. Both persist into the same flat variant list —
//  `splitFoilFinishes` / `expandFoilFinishes` convert between the two shapes.
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

// The single chip that means "this card has a foil or holo finish". Every game
// prints a dozen-plus named finishes and listing them all as chips made the
// Card Variant / Finish box a wall of near-identical options. One chip is
// offered instead, and picking it reveals the Foil / Holo Details panel where
// the specific finish is chosen — the same shape as the Rookie, Refractor and
// Prizm detail panels.
export const FOIL_VARIANT = 'Foil / Holo';

// The specific finishes, per game, as { value, desc } for that details panel.
// `value` is the variant string that gets persisted (alongside FOIL_VARIANT) on
// vault_items.variant — these are the *same* strings that used to be chips, so
// browse filters (lib/cardFilters.js TCG_RARITIES), search and every existing
// listing keep matching. Never rename one; only add.
export const GAME_FOIL_FINISHES = {
  [GAME_KEYS.POKEMON]: [
    { value: 'Holo',                    desc: 'Holofoil shine over the artwork only' },
    { value: 'Reverse Holo',            desc: 'Holo across the card body, plain artwork' },
    { value: 'Cosmos Holo',             desc: 'Star-field "cosmos" holo pattern' },
    { value: 'Cracked Ice Holo',        desc: 'Shattered cracked-ice pattern' },
    { value: 'Confetti Holo',           desc: 'Speckled confetti pattern' },
    { value: 'Saw-tooth / Tinsel Holo', desc: 'Vintage saw-tooth tinsel pattern' },
    { value: 'Sheen / Leaf Holo',       desc: 'Soft sheen / leaf pattern holo' },
    { value: 'Galaxy / Etched Holo',    desc: 'Etched galaxy swirl (Shiny Vault era)' },
    { value: 'Pokéball Holo',           desc: 'Repeating Poké Ball pattern' },
    { value: 'Masterball Holo',         desc: 'Repeating Master Ball pattern — scarcer' },
    { value: 'Textured',                desc: 'Raised texture over the artwork' },
    { value: 'Rainbow',                 desc: 'Rainbow / hyper rare rainbow finish' },
    { value: 'Gold',                    desc: 'Gold-bordered or gold-etched finish' },
    { value: 'Silver',                  desc: 'Silver / metallic finish' },
  ],

  [GAME_KEYS.MAGIC]: [
    { value: 'Foil',                    desc: 'Standard traditional foil' },
    { value: 'Etched Foil',             desc: 'Matte etched foil — no curl' },
    { value: 'Surge Foil',              desc: 'Rippling surge pattern' },
    { value: 'Galaxy Foil',             desc: 'Star-field galaxy pattern' },
    { value: 'Textured Foil',           desc: 'Raised, patterned texture' },
    { value: 'Step-and-Compleat Foil',  desc: 'Phyrexian oil-drop pattern (ONE)' },
    { value: 'Halo Foil',               desc: 'Halo ring pattern' },
    { value: 'Confetti Foil',           desc: 'Speckled confetti pattern' },
    { value: 'Gilded Foil',             desc: 'Gold-embossed gilded frame' },
    { value: 'Oil Slick Foil',          desc: 'Dark oil-slick sheen (ONE collector)' },
    { value: 'Raised Foil',             desc: 'Embossed, raised foil elements' },
    { value: 'Double Rainbow Foil',     desc: 'Ultra-rare double rainbow treatment' },
    { value: 'Neon Ink',                desc: 'Neon ink colour treatment' },
    { value: 'Manga / Ink Foil',        desc: 'Manga-style ink foil treatment' },
  ],
};

// ─── Per-game variant groups ────────────────────────────────────────────────
export const GAME_VARIANT_GROUPS = {
  [GAME_KEYS.POKEMON]: [
    {
      // The individual holo patterns (Cosmos, Cracked Ice, Pokéball…) are not
      // chips — selecting the single FOIL_VARIANT chip reveals the "Foil / Holo
      // Details" panel on the Add/Edit Card page, where they are picked. See
      // GAME_FOIL_FINISHES below.
      label: 'Finish / Foil',
      variants: ['Base', FOIL_VARIANT],
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
      // As with Pokémon: one FOIL_VARIANT chip, and the individual foil
      // treatments live in the Foil / Holo Details panel.
      label: 'Finish / Foil',
      variants: ['Nonfoil', FOIL_VARIANT],
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
 * Chip groups for a given collection/game — what the Card Variant / Finish box
 * offers. Falls back to the combined list when the collection has no dedicated
 * taxonomy (or none is selected yet). Note this deliberately excludes the
 * specific foil/holo finishes: those live behind the FOIL_VARIANT chip, in
 * `getFoilFinishes`.
 */
export function getVariantGroups(gameOrCollection) {
  const key = resolveGameKey(gameOrCollection);
  return key ? GAME_VARIANT_GROUPS[key] : ALL_VARIANT_GROUPS;
}

/** Flat list of the chip variants for a given collection/game. */
export function getVariantChips(gameOrCollection) {
  return getVariantGroups(gameOrCollection).flatMap(g => g.variants);
}

/**
 * The specific foil/holo finishes offered for a collection/game, as
 * { value, desc } — the options in the Foil / Holo Details panel. Combines
 * every game's list when the collection has no dedicated taxonomy.
 *
 * A finish that is already a chip for this game is left out, so nothing is ever
 * offered in two places: the sports taxonomy keeps 'Holo', 'Rainbow', 'Gold'
 * and 'Silver' as parallel chips of its own.
 */
export function getFoilFinishes(gameOrCollection) {
  const key = resolveGameKey(gameOrCollection);
  const lists = key
    ? (GAME_FOIL_FINISHES[key] ? [GAME_FOIL_FINISHES[key]] : [])
    : Object.values(GAME_FOIL_FINISHES);
  const chips = new Set(getVariantChips(gameOrCollection));
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const finish of list) {
      if (chips.has(finish.value) || seen.has(finish.value)) continue;
      seen.add(finish.value);
      out.push(finish);
    }
  }
  return out;
}

/**
 * Every variant string valid for a collection/game — chips plus the specific
 * foil/holo finishes. This is the persisted vocabulary: browse filters offer it
 * and identifications are resolved against it, both of which must still know
 * about 'Reverse Holo' and friends even though they are no longer chips.
 */
export function getCardVariants(gameOrCollection) {
  return [...getVariantChips(gameOrCollection), ...getFoilFinishes(gameOrCollection).map(f => f.value)];
}

/**
 * Splits a persisted/identified variant list into the chips the form shows and
 * the foil finishes the details panel shows, adding the FOIL_VARIANT chip when
 * a finish is present.
 *
 * This is what lets the strings stay exactly as they were on disk: a listing
 * saved as "Reverse Holo, Full Art" loads as the Foil / Holo + Full Art chips
 * with Reverse Holo ticked in the panel. Collection-aware, so a sports card's
 * own 'Holo' parallel chip is left alone.
 *
 * @param {string[]|null|undefined} variants
 * @param {string} gameOrCollection
 * @returns {{ variants: string[], foilFinishes: string[] }}
 */
export function splitFoilFinishes(variants, gameOrCollection) {
  const finishes = new Set(getFoilFinishes(gameOrCollection).map(f => f.value));
  const chips = [];
  const foilFinishes = [];
  let foilChipAdded = false;
  const addFoilChip = () => {
    if (!foilChipAdded) { chips.push(FOIL_VARIANT); foilChipAdded = true; }
  };

  for (const variant of Array.isArray(variants) ? variants : []) {
    if (variant === FOIL_VARIANT) { addFoilChip(); continue; }
    if (finishes.has(variant)) {
      addFoilChip();
      if (!foilFinishes.includes(variant)) foilFinishes.push(variant);
      continue;
    }
    if (!chips.includes(variant)) chips.push(variant);
  }

  return { variants: chips, foilFinishes };
}

/**
 * The inverse of `splitFoilFinishes`: the list to persist, with the chosen
 * finishes folded back in alongside the FOIL_VARIANT chip. Finishes are dropped
 * when the chip isn't selected, so unticking Foil / Holo can't leave a stale
 * finish on the listing.
 *
 * @param {string[]|null|undefined} variants - the chip selection
 * @param {string[]|null|undefined} foilFinishes - the panel selection
 * @returns {string[]}
 */
export function expandFoilFinishes(variants, foilFinishes) {
  const chips = Array.isArray(variants) ? variants : [];
  if (!chips.includes(FOIL_VARIANT)) return [...chips];
  const extra = (Array.isArray(foilFinishes) ? foilFinishes : []).filter(f => f && !chips.includes(f));
  return [...chips, ...extra];
}

// ─── Legacy exports (backward compatible) ───────────────────────────────────
// VARIANT_GROUPS / CARD_VARIANTS now represent the union across all games so
// existing consumers that don't pass a collection keep working unchanged.
export const VARIANT_GROUPS = ALL_VARIANT_GROUPS;
// Every variant string across every game — chips *and* foil finishes, so the
// legacy flat list still contains the finishes that are no longer chips.
export const CARD_VARIANTS = getCardVariants(undefined);

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

// The autograph chip. Like the rookie chip it drives its own pill rather than
// being rendered as a plain variant chip — see `getAutographLabel` in
// lib/cardAttributeLabels.js, which reads the same designation off either this
// chip or the is_auto flag and words it with whatever autograph detail exists
// ("Dual On-Card Auto"). Card tiles must therefore skip it in the generic chip
// row (`genericVariantChips`), or the card shows two Auto pills.
export const AUTO_VARIANT = 'Auto';

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
  // A bare "foil" names no specific treatment. Magic has a 'Foil' finish so the
  // exact match wins there; everywhere else it lands on the umbrella chip.
  foil: FOIL_VARIANT,
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

// Products whose *name* is the finish: every card in Topps Chrome is chrome,
// every card in Panini Mosaic has the mosaic pattern. Matched on whole words so
// "Optic" can't be found inside an unrelated word, and so "Topps Chrome
// Sapphire" still resolves to Chrome.
//
// Deliberately small. A product only belongs here when the finish is true of
// *every* card in it — which is why Donruss and Obsidian are absent: their base
// cards carry no such finish, and the parallels that do are named separately on
// the card itself.
const PRODUCT_FINISHES = [
  { word: 'chrome', chip: 'Chrome' },
  { word: 'mosaic', chip: 'Mosaic' },
  { word: 'optic',  chip: 'Optic' },
  { word: 'prizm',  chip: 'Prizm' },
];

/**
 * Finish names implied by the product a card belongs to.
 *
 * Returned as raw names rather than chips — `resolveVariantChips` still decides
 * whether the chip exists for the collection, so a hypothetical "Chrome" set in
 * a game without that chip contributes nothing.
 *
 * @param {string|null|undefined} setName - the product, e.g. "Topps Chrome"
 * @returns {string[]}
 */
export function productFinishNames(setName) {
  const words = new Set(
    String(setName ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  );
  return PRODUCT_FINISHES.filter(({ word }) => words.has(word)).map(({ chip }) => chip);
}

/**
 * Everything an identification can contribute to the variant chips: the rookie
 * designation, the treatments read off the card, "Numbered" implied by a
 * printed serial, and the finish implied by the product name.
 *
 * Additive, like `mergeRookieVariant` — identification can tell us what a card
 * IS, never that the seller's own selections are wrong.
 *
 * @param {string[]} variants - the seller's current selection
 * @param {{rookie?: string, attributes?: string[], serialNumber?: string, cardSetName?: string}} identified
 * @param {string} collection
 * @returns {string[]}
 */
export function mergeIdentifiedVariants(variants, identified = {}, collection) {
  const withRookie = mergeRookieVariant(variants, identified.rookie);

  const attributes = [...(identified.attributes ?? [])];
  // A printed serial ("23/99") is itself proof the card is numbered.
  if (String(identified.serialNumber ?? '').trim()) attributes.push('Numbered');
  // Some products *are* a finish — every card in Topps Chrome is chrome. Derived
  // here rather than asked of the model, which the OCR prompt deliberately
  // forbids from naming a treatment it cannot see printed on the card. Same
  // shape as "Numbered" above: a fact implied by something already read, not a
  // guess about what the card looks like.
  attributes.push(...productFinishNames(identified.cardSetName));

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
  [AUTO_VARIANT]: {
    label: 'AUTO',
    // blue-600, not blue-500: the overlay renders the label at 11px bold, and
    // white on blue-500 is 3.67:1 — under the 4.5:1 WCAG AA floor the a11y e2e
    // enforces. blue-600 is 5.17:1. The border/glow below stay blue-500; they
    // carry no text, so the contrast rule doesn't reach them.
    bg: 'bg-blue-600', text: 'text-white',
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
