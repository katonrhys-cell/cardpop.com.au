/**
 * Curated list of popular collectible cards and their optimised eBay AU search queries.
 * Each entry maps directly to one of the demo cards shown on the Markets page.
 * The searchQuery is tuned for eBay AU Browse API to return the most relevant active listings.
 */
export const POPULAR_CARDS = [
  // ── Pokémon ──────────────────────────────────────────────────────────────
  {
    id: 'charizard-ex-obf',
    name: 'Charizard ex (Special Illustration Rare)',
    set: 'Obsidian Flames',
    collection: 'Pokémon',
    searchQuery: 'Pokemon Charizard ex Special Illustration Rare Obsidian Flames',
  },
  {
    id: 'charizard-vstar-brs',
    name: 'Charizard VSTAR 018/172',
    set: 'Brilliant Stars',
    collection: 'Pokémon',
    searchQuery: 'Pokemon Charizard VSTAR 018/172 Brilliant Stars',
  },
  {
    id: 'pikachu-vmax-viv',
    name: 'Pikachu VMAX 044/185',
    set: 'Vivid Voltage',
    collection: 'Pokémon',
    searchQuery: 'Pokemon Pikachu VMAX 044/185 Vivid Voltage',
  },
  {
    id: 'charizard-holo-base',
    name: 'Charizard Holo (Base Set)',
    set: 'Base Set',
    collection: 'Pokémon',
    searchQuery: 'Pokemon Charizard Holo Base Set shadowless 1999',
  },
  {
    id: 'mew-ex-151',
    name: 'Mew ex 151/165',
    set: 'Scarlet & Violet 151',
    collection: 'Pokémon',
    searchQuery: 'Pokemon Mew ex 151/165 Scarlet Violet 151',
  },
  {
    id: 'charizard-vmax-rainbow',
    name: 'Charizard VMAX (Rainbow Rare)',
    set: "Champion's Path",
    collection: 'Pokémon',
    searchQuery: "Pokemon Charizard VMAX Rainbow Rare Champion's Path",
  },
  {
    id: 'umbreon-vmax-alt',
    name: 'Umbreon VMAX (Alt Art)',
    set: 'Evolving Skies',
    collection: 'Pokémon',
    searchQuery: 'Pokemon Umbreon VMAX Alternate Art Evolving Skies 215/203',
  },
  {
    id: 'iron-valiant-ex-alt',
    name: 'Iron Valiant ex (Alt Art)',
    set: 'Paradox Rift',
    collection: 'Pokémon',
    searchQuery: 'Pokemon Iron Valiant ex Alternate Art Paradox Rift 264/182',
  },

  // ── Magic: The Gathering ─────────────────────────────────────────────────
  {
    id: 'black-lotus-alpha',
    name: 'Black Lotus (Alpha)',
    set: 'Alpha',
    collection: 'Magic: The Gathering',
    searchQuery: 'Magic the Gathering Black Lotus Alpha 1993',
  },
  {
    id: 'underground-sea',
    name: 'Underground Sea (Revised)',
    set: 'Revised',
    collection: 'Magic: The Gathering',
    searchQuery: 'Magic the Gathering Underground Sea Revised dual land',
  },

  // ── NBA ──────────────────────────────────────────────────────────────────
  {
    id: 'lebron-james-rc-auto',
    name: 'LeBron James RC Auto',
    set: '2003-04 Upper Deck',
    collection: 'NBA',
    searchQuery: 'LeBron James Rookie Auto 2003-04 Upper Deck autograph',
  },
  {
    id: 'michael-jordan-1986-fleer',
    name: 'Michael Jordan 1986 Fleer RC',
    set: '1986-87 Fleer',
    collection: 'NBA',
    searchQuery: 'Michael Jordan 1986-87 Fleer Rookie Card #57 PSA',
  },
  {
    id: 'wembanyama-prizm-rc',
    name: 'Victor Wembanyama Prizm RC',
    set: '2023-24 Panini Prizm',
    collection: 'NBA',
    searchQuery: 'Victor Wembanyama Panini Prizm Rookie Card 2023-24',
  },
  {
    id: 'luka-doncic-prizm-rc',
    name: 'Luka Doncic Prizm RC',
    set: '2018-19 Panini Prizm',
    collection: 'NBA',
    searchQuery: 'Luka Doncic Panini Prizm Rookie Card 2018-19',
  },

  // ── NHL ──────────────────────────────────────────────────────────────────
  {
    id: 'mcdavid-young-guns',
    name: 'Connor McDavid Young Guns',
    set: '2015-16 Upper Deck',
    collection: 'NHL',
    searchQuery: 'Connor McDavid Young Guns 2015-16 Upper Deck Rookie',
  },

  // ── Yu-Gi-Oh! ────────────────────────────────────────────────────────────
  {
    id: 'blue-eyes-white-dragon',
    name: 'Blue-Eyes White Dragon 1st Edition',
    set: 'Legend of Blue Eyes',
    collection: 'Yu-Gi-Oh!',
    searchQuery: 'Yu-Gi-Oh Blue Eyes White Dragon 1st Edition LOB',
  },
];

/**
 * Lookup a popular card config by its id.
 */
export const findPopularCard = (id) => POPULAR_CARDS.find(c => c.id === id) || null;
